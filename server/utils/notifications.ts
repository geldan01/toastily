import { and, asc, desc, eq, gte, inArray, isNull, or } from 'drizzle-orm'
import { schema, useDrizzle } from '../db/client'
import { sendEmail } from './email-service'
import { getSetting } from './settings'

type Locale = 'en' | 'fr'

export interface UnfilledMeeting {
  date: string
  meetingNumber: number | null
  themeEn: string | null
  themeFr: string | null
  roles: { en: string, fr: string }[]
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

  const result: UnfilledMeeting[] = []
  for (const m of meetings) {
    const templateId = m.templateId ?? defaultTpl?.id ?? null
    if (!templateId) {
      result.push({ date: m.date, meetingNumber: m.meetingNumber, themeEn: m.themeEn, themeFr: m.themeFr, roles: [] })
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
    })
  }

  return result
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

function localizedDate(date: string, locale: Locale): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

/** Render the unfilled-roles list as an HTML fragment for the given locale. */
function renderUnfilledHtml(meetings: UnfilledMeeting[], locale: Locale): string {
  const noneOpen = locale === 'fr' ? 'Tous les rôles sont pourvus. Merci!' : 'All roles are filled. Thank you!'
  const noMeeting = locale === 'fr' ? 'Aucune réunion à venir.' : 'No upcoming meetings.'
  if (meetings.length === 0) return `<p>${noMeeting}</p>`

  const sections = meetings.map((m) => {
    const heading = `${localizedDate(m.date, locale)}${m.meetingNumber ? ` (#${m.meetingNumber})` : ''}`
    const link = `${siteUrl()}/meeting/${m.date}`
    if (m.roles.length === 0) return `<p><strong>${heading}</strong><br>${noneOpen}</p>`
    const items = m.roles.map(r => `<li>${locale === 'fr' ? r.fr : r.en}</li>`).join('')
    return `<p><strong><a href="${link}">${heading}</a></strong></p><ul>${items}</ul>`
  })
  return sections.join('\n')
}

/** Substitute the supported placeholders in a template body for one locale. */
async function renderBody(body: string, locale: Locale, meetings: UnfilledMeeting[]): Promise<string> {
  const intro = (await getSetting(`notify.intro_${locale}`)) ?? ''
  const outro = (await getSetting(`notify.outro_${locale}`)) ?? ''
  const nearest = meetings[0]
  const signupLink = nearest ? `${siteUrl()}/meeting/${nearest.date}` : `${siteUrl()}/meetings`
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

  const recipients = await getMemberRecipients()
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
