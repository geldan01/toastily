import { and, asc, desc, eq, gte, inArray, isNull, or } from 'drizzle-orm'
import { schema, useDrizzle } from '../db/client'
import { sendEmail } from './email-service'
import { getSetting } from './settings'

type Locale = 'en' | 'fr'

/**
 * The signup-reminder template: the weekly "open roles & speech slots — please
 * sign up" email to all members for the next meeting. Special-cased so it honours
 * the per-member opt-out and is configurable by agenda/calendar managers.
 */
export const SIGNUP_REMINDER_TEMPLATE_KEY = 'unfilled_roles'

export interface UnfilledMeeting {
  date: string
  meetingNumber: number | null
  themeEn: string | null
  themeFr: string | null
  roles: { en: string, fr: string }[]
  /** Prepared-speech slots with no speaker yet (signup opportunities). */
  openSpeechSlots: number
}

function siteUrl(): string {
  return process.env.SITE_URL || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Upcoming scheduled meetings (today onward) with their **unfilled role-bound
 * agenda items** — the data behind the weekly reminder (PRD §10 + §6). Mirrors
 * the agenda generator's template resolution (server/api/agenda/[date].get.ts):
 * a role is "unfilled" when a role-bound `item` has no signup with a member or
 * guest. `speeches`/`evaluations` blocks are ignored (not fixed roles).
 */
export async function getUpcomingUnfilled(limit = 2): Promise<UnfilledMeeting[]> {
  const db = useDrizzle()

  const meetings = await db.select({
    id: schema.meetings.id,
    date: schema.meetings.date,
    meetingNumber: schema.meetings.meetingNumber,
    themeEn: schema.meetings.themeEn,
    themeFr: schema.meetings.themeFr,
    templateId: schema.meetings.templateId,
  })
    .from(schema.meetings)
    .where(and(eq(schema.meetings.status, 'scheduled'), gte(schema.meetings.date, todayIso())))
    .orderBy(asc(schema.meetings.date))
    .limit(limit)

  if (meetings.length === 0) return []

  // Default template id, used when a meeting doesn't pin its own.
  const [defaultTpl] = await db.select({ id: schema.agendaTemplates.id })
    .from(schema.agendaTemplates)
    .orderBy(desc(schema.agendaTemplates.isDefault), asc(schema.agendaTemplates.createdAt))
    .limit(1)

  const maxPerMeeting = Number.parseInt((await getSetting('speeches.max_per_meeting')) ?? '', 10) || 3

  const result: UnfilledMeeting[] = []
  for (const m of meetings) {
    const openSpeechSlots = await openSpeechSlotsFor(m.id, maxPerMeeting)
    const templateId = m.templateId ?? defaultTpl?.id ?? null
    if (!templateId) {
      result.push({ date: m.date, meetingNumber: m.meetingNumber, themeEn: m.themeEn, themeFr: m.themeFr, roles: [], openSpeechSlots })
      continue
    }

    // Role-bound template items, joined to this meeting's signups. A role is
    // unfilled when there is no signup or the signup has neither a member nor a
    // guest name.
    const rows = await db.select({
      roleEn: schema.meetingRoles.nameEn,
      roleFr: schema.meetingRoles.nameFr,
      sortOrder: schema.agendaTemplateItems.sortOrder,
      userId: schema.meetingRoleSignups.userId,
      guestName: schema.meetingRoleSignups.guestName,
    })
      .from(schema.agendaTemplateItems)
      .innerJoin(schema.meetingRoles, eq(schema.meetingRoles.id, schema.agendaTemplateItems.meetingRoleId))
      .leftJoin(
        schema.meetingRoleSignups,
        and(
          eq(schema.meetingRoleSignups.meetingId, m.id),
          eq(schema.meetingRoleSignups.roleId, schema.agendaTemplateItems.meetingRoleId),
        ),
      )
      .where(and(
        eq(schema.agendaTemplateItems.templateId, templateId),
        eq(schema.agendaTemplateItems.itemType, 'item'),
        eq(schema.meetingRoles.active, true),
        or(isNull(schema.meetingRoleSignups.id), and(isNull(schema.meetingRoleSignups.userId), isNull(schema.meetingRoleSignups.guestName))),
      ))
      .orderBy(asc(schema.agendaTemplateItems.sortOrder))

    // A role has a single signup slot per meeting, but a template may bind it to
    // more than one agenda line — dedupe so each open role is listed once.
    const seen = new Set<string>()
    const roles: { en: string, fr: string }[] = []
    for (const r of rows) {
      if (seen.has(r.roleEn)) continue
      seen.add(r.roleEn)
      roles.push({ en: r.roleEn, fr: r.roleFr })
    }

    result.push({
      date: m.date,
      meetingNumber: m.meetingNumber,
      themeEn: m.themeEn,
      themeFr: m.themeFr,
      roles,
      openSpeechSlots,
    })
  }

  return result
}

/**
 * Count prepared-speech slots with no speaker yet for a meeting. Slots offered =
 * max(`speeches.max_per_meeting`, existing speech rows); open = offered minus the
 * speeches that already have a speaker (member or guest). Mirrors the signup
 * page's slot count.
 */
async function openSpeechSlotsFor(meetingId: string, maxPerMeeting: number): Promise<number> {
  const rows = await useDrizzle()
    .select({
      presenterUserId: schema.speeches.presenterUserId,
      presenterGuestName: schema.speeches.presenterGuestName,
    })
    .from(schema.speeches)
    .where(eq(schema.speeches.meetingId, meetingId))
  const filled = rows.filter(r => r.presenterUserId || r.presenterGuestName).length
  const offered = Math.max(maxPerMeeting, rows.length)
  return Math.max(0, offered - filled)
}

/** Members/officers/admins with a deliverable email, plus their locale. */
export async function getMemberRecipients(): Promise<{ email: string, locale: Locale }[]> {
  const rows = await useDrizzle()
    .select({ email: schema.users.email, locale: schema.users.locale })
    .from(schema.users)
    .where(inArray(schema.users.status, ['member', 'officer', 'admin']))
  return rows
    .filter(r => r.email?.includes('@'))
    .map(r => ({ email: r.email, locale: r.locale === 'fr' ? 'fr' : 'en' }))
}

/**
 * Members/officers/admins who haven't opted out of the signup reminder, with a
 * deliverable email. Same as `getMemberRecipients` but filtered by the
 * `notifySignupReminders` preference.
 */
export async function getSignupReminderRecipients(): Promise<{ email: string, locale: Locale }[]> {
  const rows = await useDrizzle()
    .select({ email: schema.users.email, locale: schema.users.locale })
    .from(schema.users)
    .where(and(
      inArray(schema.users.status, ['member', 'officer', 'admin']),
      eq(schema.users.notifySignupReminders, true),
    ))
  return rows
    .filter(r => r.email?.includes('@'))
    .map(r => ({ email: r.email, locale: r.locale === 'fr' ? 'fr' : 'en' }))
}

/** Minimal HTML escaping for user-supplied values interpolated into emails. */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

/**
 * Recipients of the membership-request notification (issue #50): the current
 * holder(s) of any executive position flagged `notifyMemberRequests`, plus every
 * site admin. Routing is data-driven — never a hard-coded position name
 * (CLAUDE.md). Deduplicated by email.
 */
export async function getMembershipRequestRecipients(): Promise<{ email: string, locale: Locale }[]> {
  const db = useDrizzle()

  const admins = await db
    .select({ email: schema.users.email, locale: schema.users.locale })
    .from(schema.users)
    .where(eq(schema.users.status, 'admin'))

  const flagged = await db
    .select({ email: schema.users.email, locale: schema.users.locale })
    .from(schema.executiveAssignments)
    .innerJoin(schema.executivePositions, eq(schema.executivePositions.id, schema.executiveAssignments.positionId))
    .innerJoin(schema.users, eq(schema.users.id, schema.executiveAssignments.userId))
    .where(and(
      isNull(schema.executiveAssignments.endedAt),
      eq(schema.executivePositions.active, true),
      eq(schema.executivePositions.notifyMemberRequests, true),
    ))

  const byEmail = new Map<string, { email: string, locale: Locale }>()
  for (const r of [...admins, ...flagged]) {
    if (!r.email?.includes('@')) continue
    const key = r.email.toLowerCase()
    if (byEmail.has(key)) continue
    byEmail.set(key, { email: r.email, locale: r.locale === 'fr' ? 'fr' : 'en' })
  }
  return [...byEmail.values()]
}

export interface NotifyMembershipRequestInput {
  /** Display name of the guest who requested membership. */
  requesterName: string
  /** Optional free-text message from the requester. */
  message?: string | null
  /** The requesting user's id, recorded as `triggeredBy` on the send log. */
  requesterId?: string | null
}

/**
 * Email the President / VP Membership / admins that a new membership request
 * arrived (issue #50). Renders the `membership_request_received` template per
 * recipient locale, delivers via Resend (or the log stub), and records one row
 * in `email_send_log` (trigger `triggered`). Never throws — a delivery problem
 * must not fail the underlying request; failures are captured in the log.
 */
export async function notifyMembershipRequest(input: NotifyMembershipRequestInput): Promise<SendNotificationResult> {
  const db = useDrizzle()
  const templateKey = 'membership_request_received'

  const [template] = await db.select().from(schema.emailTemplates)
    .where(eq(schema.emailTemplates.key, templateKey)).limit(1)
  if (!template) {
    return { status: 'failed', recipientCount: 0, error: `Unknown email template: ${templateKey}` }
  }

  const recipients = await getMembershipRequestRecipients()
  const requestsLink = `${siteUrl()}/membership/requests`
  const name = escapeHtml(input.requesterName)

  const renderForLocale = (subject: string, body: string, locale: Locale) => {
    const messageHtml = input.message
      ? `<blockquote>${escapeHtml(input.message)}</blockquote>`
      : (locale === 'fr' ? '<p><em>(Aucun message)</em></p>' : '<p><em>(No message)</em></p>')
    const html = body
      .replaceAll('{{requester_name}}', name)
      .replaceAll('{{message}}', messageHtml)
      .replaceAll('{{requests_link}}', requestsLink)
    return { subject, html }
  }

  const rendered: Record<Locale, { subject: string, html: string }> = {
    en: renderForLocale(template.subjectEn, template.bodyEn, 'en'),
    fr: renderForLocale(template.subjectFr, template.bodyFr, 'fr'),
  }

  let anyFailed = false
  let allStubbed = true
  let lastError: string | undefined
  let sentCount = 0

  for (const r of recipients) {
    const { subject, html } = rendered[r.locale]
    const res = await sendEmail({ to: r.email, subject, html })
    if (!res.ok) {
      anyFailed = true
      lastError = res.error
      continue
    }
    if (!res.stubbed) allStubbed = false
    sentCount++
  }

  const status: SendNotificationResult['status']
    = anyFailed ? 'failed' : (recipients.length > 0 && allStubbed ? 'stubbed' : 'sent')

  await db.insert(schema.emailSendLog).values({
    templateKey,
    trigger: 'triggered',
    status,
    recipientCount: sentCount,
    triggeredBy: input.requesterId ?? null,
    error: lastError ?? null,
  })

  return { status, recipientCount: sentCount, error: lastError }
}

interface ReminderParticipant {
  name: string
  email: string
  locale: Locale
  /** Localized assignment labels (role names, speech roles) for this member. */
  labels: { en: string[], fr: string[] }
}

/**
 * Members who hold a role or speech on a meeting and want the reminder
 * (issue #59). Keyed by user id; each carries their localized assignment labels.
 * Guests are excluded (no account / preference / reliable email here). Members
 * who opted out (`notifyRoleReminders=false`) or have no deliverable email are
 * skipped.
 */
async function getRoleReminderParticipants(meetingId: string): Promise<Map<string, ReminderParticipant>> {
  const db = useDrizzle()
  const out = new Map<string, ReminderParticipant>()

  const add = (
    user: { id: string, name: string, email: string, locale: string, notifyRoleReminders: boolean },
    en: string,
    fr: string,
  ) => {
    if (!user.notifyRoleReminders || !user.email?.includes('@')) return
    let p = out.get(user.id)
    if (!p) {
      p = { name: user.name, email: user.email, locale: user.locale === 'fr' ? 'fr' : 'en', labels: { en: [], fr: [] } }
      out.set(user.id, p)
    }
    p.labels.en.push(en)
    p.labels.fr.push(fr)
  }

  const roleRows = await db.select({
    id: schema.users.id,
    name: schema.users.name,
    email: schema.users.email,
    locale: schema.users.locale,
    notifyRoleReminders: schema.users.notifyRoleReminders,
    roleEn: schema.meetingRoles.nameEn,
    roleFr: schema.meetingRoles.nameFr,
  })
    .from(schema.meetingRoleSignups)
    .innerJoin(schema.users, eq(schema.users.id, schema.meetingRoleSignups.userId))
    .innerJoin(schema.meetingRoles, eq(schema.meetingRoles.id, schema.meetingRoleSignups.roleId))
    .where(eq(schema.meetingRoleSignups.meetingId, meetingId))
  for (const r of roleRows) add(r, r.roleEn, r.roleFr)

  const speechRows = await db.select({
    title: schema.speeches.title,
    presenterUserId: schema.speeches.presenterUserId,
    evaluatorUserId: schema.speeches.evaluatorUserId,
  })
    .from(schema.speeches)
    .where(eq(schema.speeches.meetingId, meetingId))

  // Resolve the speech participants in one pass.
  const speechUserIds = new Set<string>()
  for (const s of speechRows) {
    if (s.presenterUserId) speechUserIds.add(s.presenterUserId)
    if (s.evaluatorUserId) speechUserIds.add(s.evaluatorUserId)
  }
  if (speechUserIds.size) {
    const users = await db.select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      locale: schema.users.locale,
      notifyRoleReminders: schema.users.notifyRoleReminders,
    })
      .from(schema.users)
      .where(inArray(schema.users.id, [...speechUserIds]))
    const byId = new Map(users.map(u => [u.id, u]))
    for (const s of speechRows) {
      const title = s.title?.trim()
      if (s.presenterUserId) {
        const u = byId.get(s.presenterUserId)
        if (u) add(u, `Speaker${title ? `: ${title}` : ''}`, `Orateur${title ? ` : ${title}` : ''}`)
      }
      if (s.evaluatorUserId) {
        const u = byId.get(s.evaluatorUserId)
        if (u) add(u, `Evaluator${title ? ` for "${title}"` : ''}`, `Évaluateur${title ? ` pour « ${title} »` : ''}`)
      }
    }
  }

  return out
}

export interface NotifyRoleRemindersResult extends SendNotificationResult {
  /** Whether there was anyone to remind (drives the task's sent-flag bookkeeping). */
  hadRecipients: boolean
}

/**
 * Send the pre-meeting role reminder (issue #59) to every member holding a role
 * or speech on the given meeting, each email personalised with their own
 * assignments. Renders the `meeting_role_reminder` template per recipient locale,
 * delivers via Resend (or the log stub), and records one row in `email_send_log`
 * (trigger `scheduled`). Never throws — a delivery problem is captured in the log.
 */
export async function notifyRoleReminders(meetingId: string): Promise<NotifyRoleRemindersResult> {
  const db = useDrizzle()
  const templateKey = 'meeting_role_reminder'

  const [template] = await db.select().from(schema.emailTemplates)
    .where(eq(schema.emailTemplates.key, templateKey)).limit(1)
  if (!template) {
    return { status: 'failed', recipientCount: 0, error: `Unknown email template: ${templateKey}`, hadRecipients: false }
  }

  const [meeting] = await db.select({
    date: schema.meetings.date,
    location: schema.meetings.location,
  })
    .from(schema.meetings)
    .where(eq(schema.meetings.id, meetingId))
    .limit(1)
  if (!meeting) {
    return { status: 'failed', recipientCount: 0, error: `Unknown meeting: ${meetingId}`, hadRecipients: false }
  }

  const participants = [...(await getRoleReminderParticipants(meetingId)).values()]
  if (participants.length === 0) {
    return { status: 'sent', recipientCount: 0, hadRecipients: false }
  }

  const meetingTime = (await getSetting('meeting.time'))?.trim()
    || (await getSetting('meeting.start_time'))?.trim() || ''
  const location = meeting.location?.trim() || (await getSetting('meeting.address'))?.trim() || ''
  const link = `${siteUrl()}/meeting/${meeting.date}`

  const renderFor = (p: ReminderParticipant) => {
    const subjectTemplate = p.locale === 'fr' ? template.subjectFr : template.subjectEn
    const bodyTemplate = p.locale === 'fr' ? template.bodyFr : template.bodyEn
    const dateStr = localizedDate(meeting.date, p.locale)
    const labels = p.labels[p.locale]
    const rolesHtml = `<ul>${labels.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
    const locationHtml = location ? `, ${escapeHtml(location)}` : ''
    const subject = subjectTemplate.replaceAll('{{meeting_date}}', dateStr)
    const html = bodyTemplate
      .replaceAll('{{member_name}}', escapeHtml(p.name))
      .replaceAll('{{meeting_date}}', dateStr)
      .replaceAll('{{meeting_time}}', escapeHtml(meetingTime))
      .replaceAll('{{location}}', locationHtml)
      .replaceAll('{{roles}}', rolesHtml)
      .replaceAll('{{meeting_link}}', link)
    return { subject, html }
  }

  let anyFailed = false
  let allStubbed = true
  let lastError: string | undefined
  let sentCount = 0

  for (const p of participants) {
    const { subject, html } = renderFor(p)
    const res = await sendEmail({ to: p.email, subject, html })
    if (!res.ok) {
      anyFailed = true
      lastError = res.error
      continue
    }
    if (!res.stubbed) allStubbed = false
    sentCount++
  }

  const status: SendNotificationResult['status']
    = anyFailed ? 'failed' : (allStubbed ? 'stubbed' : 'sent')

  await db.insert(schema.emailSendLog).values({
    templateKey,
    trigger: 'scheduled',
    status,
    recipientCount: sentCount,
    triggeredBy: null,
    error: lastError ?? null,
  })

  return { status, recipientCount: sentCount, error: lastError, hadRecipients: true }
}

function localizedDate(date: string, locale: Locale): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

/** Signup page for a meeting (members claim open roles / speech slots here). */
function signupUrl(date: string): string {
  return `${siteUrl()}/meeting/${date}/signup`
}

/**
 * Render the open roles **and** open speech slots per meeting as an HTML fragment
 * for the given locale. Each meeting heading links to its signup page; a meeting
 * with nothing open shows an "all filled" note.
 */
function renderUnfilledHtml(meetings: UnfilledMeeting[], locale: Locale): string {
  const allFilled = locale === 'fr' ? 'Tout est pourvu. Merci!' : 'Everything is filled. Thank you!'
  const noMeeting = locale === 'fr' ? 'Aucune réunion à venir.' : 'No upcoming meetings.'
  const speechLabel = (n: number) => locale === 'fr'
    ? `${n} créneau${n > 1 ? 'x' : ''} d'orateur disponible${n > 1 ? 's' : ''} (discours préparés)`
    : `${n} open speaking slot${n > 1 ? 's' : ''} (prepared speeches)`
  if (meetings.length === 0) return `<p>${noMeeting}</p>`

  const sections = meetings.map((m) => {
    const heading = `${localizedDate(m.date, locale)}${m.meetingNumber ? ` (#${m.meetingNumber})` : ''}`
    const link = signupUrl(m.date)
    const items = m.roles.map(r => `<li>${locale === 'fr' ? r.fr : r.en}</li>`)
    if (m.openSpeechSlots > 0) items.push(`<li>${speechLabel(m.openSpeechSlots)}</li>`)
    if (items.length === 0) return `<p><strong>${heading}</strong><br>${allFilled}</p>`
    return `<p><strong><a href="${link}">${heading}</a></strong></p><ul>${items.join('')}</ul>`
  })
  return sections.join('\n')
}

/** Substitute the supported placeholders in a template body for one locale. */
async function renderBody(body: string, locale: Locale, meetings: UnfilledMeeting[]): Promise<string> {
  const intro = (await getSetting(`notify.intro_${locale}`)) ?? ''
  const outro = (await getSetting(`notify.outro_${locale}`)) ?? ''
  const nearest = meetings[0]
  const signupLink = nearest ? signupUrl(nearest.date) : `${siteUrl()}/meetings`
  return body
    .replaceAll('{{intro}}', intro)
    .replaceAll('{{outro}}', outro)
    .replaceAll('{{unfilled_roles}}', renderUnfilledHtml(meetings, locale))
    .replaceAll('{{signup_link}}', signupLink)
}

export interface SendNotificationInput {
  templateKey: string
  trigger: 'manual' | 'scheduled'
  triggeredBy?: string | null
}

export interface SendNotificationResult {
  status: 'sent' | 'stubbed' | 'failed'
  recipientCount: number
  error?: string
}

/**
 * Send a managed notification template to all members (PRD §10). Renders per the
 * recipient's locale, delivers via Resend (or the log stub when unconfigured),
 * and records one row in `email_send_log`. Used by both the manual "Send now"
 * API and the scheduled-task dispatcher.
 */
export async function sendNotification(input: SendNotificationInput): Promise<SendNotificationResult> {
  const db = useDrizzle()

  const [template] = await db.select().from(schema.emailTemplates)
    .where(eq(schema.emailTemplates.key, input.templateKey)).limit(1)
  if (!template) {
    throw createError({ statusCode: 404, statusMessage: `Unknown email template: ${input.templateKey}` })
  }

  // The signup reminder honours the per-member opt-out; other templates go to all.
  const recipients = input.templateKey === SIGNUP_REMINDER_TEMPLATE_KEY
    ? await getSignupReminderRecipients()
    : await getMemberRecipients()
  const meetings = await getUpcomingUnfilled()

  // Pre-render the subject + body once per locale.
  const rendered: Record<Locale, { subject: string, html: string }> = {
    en: { subject: template.subjectEn, html: await renderBody(template.bodyEn, 'en', meetings) },
    fr: { subject: template.subjectFr, html: await renderBody(template.bodyFr, 'fr', meetings) },
  }

  let anyFailed = false
  let allStubbed = true
  let lastError: string | undefined
  let sentCount = 0

  for (const r of recipients) {
    const { subject, html } = rendered[r.locale]
    const res = await sendEmail({ to: r.email, subject, html })
    if (!res.ok) {
      anyFailed = true
      lastError = res.error
      continue
    }
    if (!res.stubbed) allStubbed = false
    sentCount++
  }

  const status: SendNotificationResult['status']
    = anyFailed ? 'failed' : (recipients.length > 0 && allStubbed ? 'stubbed' : 'sent')

  await db.insert(schema.emailSendLog).values({
    templateKey: input.templateKey,
    trigger: input.trigger,
    status,
    recipientCount: sentCount,
    triggeredBy: input.triggeredBy ?? null,
    error: lastError ?? null,
  })

  return { status, recipientCount: sentCount, error: lastError }
}
