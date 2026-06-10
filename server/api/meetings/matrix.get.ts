import { and, asc, eq, gte, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { schema, useDrizzle } from '../../db/client'

/** How many upcoming meetings the signup matrix covers. */
const MATRIX_MEETINGS = 5

interface Occupant { userId: string | null, name: string | null, isGuest: boolean }

/**
 * Signup matrix (members only): the next 5 scheduled meetings with every active
 * role's occupant and every speech slot's speaker/evaluator, so members can plan
 * signups across meetings at a glance. Mutations reuse the per-meeting endpoints
 * (`/api/meetings/signup`, `/api/meetings/speech`) — this is read-only.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const db = useDrizzle()

  const today = new Date().toISOString().slice(0, 10)
  const meetings = await db.select({
    id: schema.meetings.id,
    date: schema.meetings.date,
    meetingNumber: schema.meetings.meetingNumber,
    themeEn: schema.meetings.themeEn,
    themeFr: schema.meetings.themeFr,
  })
    .from(schema.meetings)
    .where(and(gte(schema.meetings.date, today), eq(schema.meetings.status, 'scheduled')))
    .orderBy(asc(schema.meetings.date))
    .limit(MATRIX_MEETINGS)
  const meetingIds = meetings.map(m => m.id)

  const roles = await db.select({
    roleId: schema.meetingRoles.id,
    nameEn: schema.meetingRoles.nameEn,
    nameFr: schema.meetingRoles.nameFr,
  })
    .from(schema.meetingRoles)
    .where(eq(schema.meetingRoles.active, true))
    .orderBy(asc(schema.meetingRoles.sortOrder))

  // Role signups across all matrix meetings, with resolved member names.
  const signups = meetingIds.length
    ? await db.select({
        meetingId: schema.meetingRoleSignups.meetingId,
        roleId: schema.meetingRoleSignups.roleId,
        userId: schema.meetingRoleSignups.userId,
        guestName: schema.meetingRoleSignups.guestName,
        userName: schema.users.name,
      })
        .from(schema.meetingRoleSignups)
        .leftJoin(schema.users, eq(schema.users.id, schema.meetingRoleSignups.userId))
        .where(inArray(schema.meetingRoleSignups.meetingId, meetingIds))
    : []

  // Speeches across all matrix meetings (two aliased joins for the names).
  const speaker = alias(schema.users, 'speaker')
  const evaluator = alias(schema.users, 'evaluator')
  const speechRows = meetingIds.length
    ? await db.select({
        meetingId: schema.speeches.meetingId,
        slot: schema.speeches.slot,
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
        .where(inArray(schema.speeches.meetingId, meetingIds))
    : []

  // Same slot fan-out rule as the per-meeting page: max(existing, setting).
  const maxSetting = Number(await getSetting('speeches.max_per_meeting'))
  const slotCount = Math.max(
    speechRows.reduce((m, s) => Math.max(m, s.slot), 0),
    Number.isFinite(maxSetting) && maxSetting > 0 ? maxSetting : 0,
  )

  // Per-meeting manage authority: officers/admin everywhere, otherwise the
  // meetings where the viewer holds an authority-granting role (one query).
  const isOfficer = hasMinRole(user.status, 'officer')
  let authorityIds = new Set<string>()
  if (!isOfficer && meetingIds.length) {
    const rows = await db.select({ meetingId: schema.meetingRoleSignups.meetingId })
      .from(schema.meetingRoleSignups)
      .innerJoin(schema.meetingRoles, eq(schema.meetingRoles.id, schema.meetingRoleSignups.roleId))
      .where(and(
        inArray(schema.meetingRoleSignups.meetingId, meetingIds),
        eq(schema.meetingRoleSignups.userId, user.id),
        eq(schema.meetingRoles.grantsMeetingAuthority, true),
      ))
    authorityIds = new Set(rows.map(r => r.meetingId))
  }

  return {
    slotCount,
    roles,
    meetings: meetings.map((m) => {
      const roleOccupants: Record<string, Occupant> = {}
      for (const s of signups.filter(s => s.meetingId === m.id)) {
        roleOccupants[s.roleId] = { userId: s.userId, name: s.userId ? s.userName : s.guestName, isGuest: !s.userId }
      }
      const speeches: Record<string, { speaker: Occupant | null, evaluator: Occupant | null }> = {}
      for (const s of speechRows.filter(s => s.meetingId === m.id)) {
        speeches[String(s.slot)] = {
          speaker: s.presenterUserId || s.presenterGuestName
            ? { userId: s.presenterUserId, name: s.presenterUserId ? s.speakerName : s.presenterGuestName, isGuest: !s.presenterUserId }
            : null,
          evaluator: s.evaluatorUserId || s.evaluatorGuestName
            ? { userId: s.evaluatorUserId, name: s.evaluatorUserId ? s.evaluatorName : s.evaluatorGuestName, isGuest: !s.evaluatorUserId }
            : null,
        }
      }
      return { ...m, canManage: isOfficer || authorityIds.has(m.id), roleOccupants, speeches }
    }),
  }
})
