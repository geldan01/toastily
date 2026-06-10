import { and, asc, desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { schema, useDrizzle } from '../../db/client'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface AgendaLine {
  kind: 'item' | 'speech' | 'evaluation'
  section: 'administrative' | 'speeches' | 'table_topics' | 'evaluations'
  labelEn: string
  labelFr: string
  durationMinutes: number | null
  // Role bound to this line (for item lines), localized client-side.
  roleEn?: string | null
  roleFr?: string | null
  // The bound role counts as an evaluator (e.g. the Grammarian) — highlighted
  // on the agenda alongside speech evaluators. Data flag, never a name match.
  isEvaluatorRole?: boolean
  // The filled participant (signup occupant, presenter, or evaluator).
  who?: string | null
  isGuest?: boolean
  // Speech extras.
  slot?: number
  title?: string | null
}

/**
 * Generate a meeting's agenda (PRD §6.4) by expanding its template: role-bound
 * items are filled from current signups; `speeches`/`evaluations` blocks fan
 * out per prepared speech — but only for speeches that have a speaker (an
 * evaluator signed up on a speakerless slot produces no line). Also returns the
 * meeting's officers (roles flagged `is_meeting_officer` with their occupants)
 * for the agenda's introduction block. The same shape drives the on-screen
 * agenda and its printable/PDF view.
 */
export default defineEventHandler(async (event) => {
  const date = getRouterParam(event, 'date')!
  if (!DATE_RE.test(date)) throw createError({ statusCode: 400, statusMessage: 'Date must be YYYY-MM-DD.' })

  const db = useDrizzle()
  const [meeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.date, date)).limit(1)
  const [holiday] = await db.select().from(schema.calendarExceptions).where(eq(schema.calendarExceptions.date, date)).limit(1)
  if (!meeting) return { meeting: null, holiday: holiday ?? null, lines: [], officers: [] }

  const meta = {
    date: meeting.date,
    meetingNumber: meeting.meetingNumber,
    status: meeting.status,
    themeEn: meeting.themeEn,
    themeFr: meeting.themeFr,
    location: meeting.location,
    notesEn: meeting.notesEn,
    notesFr: meeting.notesFr,
  }

  // A cancelled meeting keeps its header (banner client-side) but has no agenda.
  if (meeting.status === 'cancelled') return { meeting: meta, holiday: holiday ?? null, lines: [], officers: [] }

  // Resolve the template (the meeting's, else the default/first).
  let templateId = meeting.templateId
  if (!templateId) {
    const [tpl] = await db.select({ id: schema.agendaTemplates.id })
      .from(schema.agendaTemplates)
      .orderBy(desc(schema.agendaTemplates.isDefault), asc(schema.agendaTemplates.createdAt))
      .limit(1)
    templateId = tpl?.id ?? null
  }

  const items = templateId
    ? await db.select({
        itemType: schema.agendaTemplateItems.itemType,
        section: schema.agendaTemplateItems.section,
        labelEn: schema.agendaTemplateItems.labelEn,
        labelFr: schema.agendaTemplateItems.labelFr,
        durationMinutes: schema.agendaTemplateItems.durationMinutes,
        roleId: schema.agendaTemplateItems.meetingRoleId,
        roleEn: schema.meetingRoles.nameEn,
        roleFr: schema.meetingRoles.nameFr,
        roleCountsAsEvaluator: schema.meetingRoles.countsAsEvaluator,
      })
        .from(schema.agendaTemplateItems)
        .leftJoin(schema.meetingRoles, eq(schema.meetingRoles.id, schema.agendaTemplateItems.meetingRoleId))
        .where(eq(schema.agendaTemplateItems.templateId, templateId))
        .orderBy(asc(schema.agendaTemplateItems.sortOrder))
    : []

  // Signups for this meeting → roleId → occupant.
  const signups = await db.select({
    roleId: schema.meetingRoleSignups.roleId,
    userId: schema.meetingRoleSignups.userId,
    guestName: schema.meetingRoleSignups.guestName,
    userName: schema.users.name,
  })
    .from(schema.meetingRoleSignups)
    .leftJoin(schema.users, eq(schema.users.id, schema.meetingRoleSignups.userId))
    .where(eq(schema.meetingRoleSignups.meetingId, meeting.id))
  const occupant = new Map(signups.map(s => [s.roleId, { who: s.userId ? s.userName : s.guestName, isGuest: !s.userId }]))

  // Meeting officers (PRD §3.3): roles flagged is_meeting_officer, with their
  // current occupant — vacant roles included so gaps are visible to the chair.
  const officerRoles = await db.select({
    id: schema.meetingRoles.id,
    nameEn: schema.meetingRoles.nameEn,
    nameFr: schema.meetingRoles.nameFr,
  })
    .from(schema.meetingRoles)
    .where(and(eq(schema.meetingRoles.active, true), eq(schema.meetingRoles.isMeetingOfficer, true)))
    .orderBy(asc(schema.meetingRoles.sortOrder), asc(schema.meetingRoles.createdAt))
  const officers = officerRoles.map(r => ({
    nameEn: r.nameEn,
    nameFr: r.nameFr,
    who: occupant.get(r.id)?.who ?? null,
    isGuest: occupant.get(r.id)?.isGuest ?? false,
  }))

  // Speeches, plus presenter/evaluator member names (two aliased user joins).
  const presenter = alias(schema.users, 'presenter')
  const evaluator = alias(schema.users, 'evaluator')
  const speeches = await db.select({
    slot: schema.speeches.slot,
    title: schema.speeches.title,
    maxMinutes: schema.speeches.maxMinutes,
    presenterGuestName: schema.speeches.presenterGuestName,
    presenterName: presenter.name,
    evaluatorGuestName: schema.speeches.evaluatorGuestName,
    evaluatorName: evaluator.name,
  })
    .from(schema.speeches)
    .leftJoin(presenter, eq(presenter.id, schema.speeches.presenterUserId))
    .leftJoin(evaluator, eq(evaluator.id, schema.speeches.evaluatorUserId))
    .where(eq(schema.speeches.meetingId, meeting.id))
    .orderBy(asc(schema.speeches.slot))
  const speechBySlot = new Map(speeches.map(s => [s.slot, s]))

  const maxSetting = Number(await getSetting('speeches.max_per_meeting'))
  const slotCount = Math.max(speeches.length, Number.isFinite(maxSetting) && maxSetting > 0 ? maxSetting : 0)
  const timing = await speechTiming()

  const lines: AgendaLine[] = []
  for (const it of items) {
    if (it.itemType === 'speeches' || it.itemType === 'evaluations') {
      for (let slot = 1; slot <= slotCount; slot++) {
        const s = speechBySlot.get(slot)
        // Only scheduled speeches appear on the agenda: a slot with no speaker
        // is skipped, including its evaluation (an evaluator may have signed up
        // before any speech materialized for the slot).
        if (!(s && (s.presenterGuestName || s.presenterName))) continue
        if (it.itemType === 'speeches') {
          // Each speech is allotted its max time plus the agenda buffer, not the
          // template item's nominal duration (PRD §6.3).
          lines.push({
            kind: 'speech',
            section: it.section,
            labelEn: it.labelEn,
            labelFr: it.labelFr,
            durationMinutes: agendaSpeechMinutes(s.maxMinutes, timing),
            slot,
            title: s.title ?? null,
            who: s.presenterGuestName || s.presenterName,
            isGuest: !!s.presenterGuestName,
          })
        }
        else {
          lines.push({
            kind: 'evaluation',
            section: it.section,
            labelEn: it.labelEn,
            labelFr: it.labelFr,
            durationMinutes: it.durationMinutes,
            slot,
            title: s.title ?? null,
            who: s.evaluatorGuestName || s.evaluatorName || null,
            isGuest: !!s.evaluatorGuestName,
          })
        }
      }
    }
    else {
      const occ = it.roleId ? occupant.get(it.roleId) : null
      lines.push({
        kind: 'item',
        section: it.section,
        labelEn: it.labelEn,
        labelFr: it.labelFr,
        durationMinutes: it.durationMinutes,
        roleEn: it.roleEn,
        roleFr: it.roleFr,
        isEvaluatorRole: it.roleCountsAsEvaluator ?? false,
        who: occ?.who ?? null,
        isGuest: occ?.isGuest ?? false,
      })
    }
  }

  return { meeting: meta, holiday: holiday ?? null, lines, officers }
})
