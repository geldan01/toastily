import { and, asc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { schema, useDrizzle } from '../../db/client'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Public meeting detail by date (PRD §6.1): the meeting, its active roles with
 * current signups (member or guest), its speeches, and any holiday on that day.
 * Returns `meeting: null` when no meeting exists for the date.
 */
export default defineEventHandler(async (event) => {
  const date = getRouterParam(event, 'date')!
  if (!DATE_RE.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Date must be YYYY-MM-DD.' })
  }
  const db = useDrizzle()

  const [meeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.date, date)).limit(1)
  const [holiday] = await db.select().from(schema.calendarExceptions).where(eq(schema.calendarExceptions.date, date)).limit(1)

  if (!meeting) {
    return { meeting: null, holiday: holiday ?? null, roles: [], speeches: [], canManageSignups: false }
  }

  // Whether the viewer may assign/reassign/release signups for this meeting
  // (officer/admin OR the meeting's authority-role holder, e.g. the Toastmaster).
  const viewer = await getCurrentUser(event)
  const canManageSignups = await isMeetingManager(viewer, meeting.id)

  // Active roles in display order, each with its (optional) signup occupant.
  const roles = await db.select({
    roleId: schema.meetingRoles.id,
    nameEn: schema.meetingRoles.nameEn,
    nameFr: schema.meetingRoles.nameFr,
    sortOrder: schema.meetingRoles.sortOrder,
    signupId: schema.meetingRoleSignups.id,
    userId: schema.meetingRoleSignups.userId,
    guestName: schema.meetingRoleSignups.guestName,
    userName: schema.users.name,
  })
    .from(schema.meetingRoles)
    .leftJoin(
      schema.meetingRoleSignups,
      and(
        eq(schema.meetingRoleSignups.roleId, schema.meetingRoles.id),
        eq(schema.meetingRoleSignups.meetingId, meeting.id),
      ),
    )
    .leftJoin(schema.users, eq(schema.users.id, schema.meetingRoleSignups.userId))
    .where(eq(schema.meetingRoles.active, true))
    .orderBy(asc(schema.meetingRoles.sortOrder))

  // Speeches with resolved speaker/evaluator member names (two aliased joins).
  const speaker = alias(schema.users, 'speaker')
  const evaluator = alias(schema.users, 'evaluator')
  const speechRows = await db.select({
    slot: schema.speeches.slot,
    title: schema.speeches.title,
    minMinutes: schema.speeches.minMinutes,
    maxMinutes: schema.speeches.maxMinutes,
    presenterUserId: schema.speeches.presenterUserId,
    presenterGuestName: schema.speeches.presenterGuestName,
    speakerName: speaker.name,
    evaluatorUserId: schema.speeches.evaluatorUserId,
    evaluatorGuestName: schema.speeches.evaluatorGuestName,
    evaluatorName: evaluator.name,
  })
    .from(schema.speeches)
    .leftJoin(speaker, eq(speaker.id, schema.speeches.presenterUserId))
    .leftJoin(evaluator, eq(evaluator.id, schema.speeches.evaluatorUserId))
    .where(eq(schema.speeches.meetingId, meeting.id))
    .orderBy(asc(schema.speeches.slot))
  const bySlot = new Map(speechRows.map(s => [s.slot, s]))

  // Expand to a fixed list of slots (existing speeches, else the max setting).
  const maxSetting = Number(await getSetting('speeches.max_per_meeting'))
  const slotCount = Math.max(speechRows.length, Number.isFinite(maxSetting) && maxSetting > 0 ? maxSetting : 0)
  const timing = await speechTiming()
  const speeches = Array.from({ length: slotCount }, (_, i) => {
    const s = bySlot.get(i + 1)
    return {
      slot: i + 1,
      title: s?.title ?? null,
      minMinutes: s?.minMinutes ?? timing.defaultMin,
      maxMinutes: s?.maxMinutes ?? timing.defaultMax,
      speaker: s && (s.presenterUserId || s.presenterGuestName)
        ? { userId: s.presenterUserId, name: s.presenterUserId ? s.speakerName : s.presenterGuestName, isGuest: !s.presenterUserId }
        : null,
      evaluator: s && (s.evaluatorUserId || s.evaluatorGuestName)
        ? { userId: s.evaluatorUserId, name: s.evaluatorUserId ? s.evaluatorName : s.evaluatorGuestName, isGuest: !s.evaluatorUserId }
        : null,
    }
  })

  return {
    meeting: {
      id: meeting.id,
      date: meeting.date,
      meetingNumber: meeting.meetingNumber,
      status: meeting.status,
      themeEn: meeting.themeEn,
      themeFr: meeting.themeFr,
      location: meeting.location,
      notesEn: meeting.notesEn,
      notesFr: meeting.notesFr,
      templateId: meeting.templateId,
    },
    holiday: holiday ?? null,
    canManageSignups,
    roles: roles.map(r => ({
      roleId: r.roleId,
      nameEn: r.nameEn,
      nameFr: r.nameFr,
      occupant: r.signupId
        ? { userId: r.userId, name: r.userId ? r.userName : r.guestName, isGuest: !r.userId }
        : null,
    })),
    speeches,
  }
})
