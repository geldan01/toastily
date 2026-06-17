import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Mark a member present at a meeting (issue #35, the member equivalent of guest
 * check-in). Two paths, mirroring role-signup authority (PRD §3):
 *  - a member self-checks-in (no `userId`, or their own id) → `source: 'self'`,
 *    `recordedBy: null`;
 *  - a meeting manager / secretary records another member (`userId` set) →
 *    `source: 'secretary'`, `recordedBy` = the manager.
 * One row per member per meeting — an existing mark is returned unchanged so a
 * double tap / re-record doesn't error.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  if (!hasMinRole(user.status, 'member')) {
    throw createError({ statusCode: 403, statusMessage: 'Members only' })
  }

  const body = await readBody(event)
  const meetingId = String(body?.meetingId ?? '')
  const targetId = body?.userId ? String(body.userId) : user.id
  if (!meetingId) throw createError({ statusCode: 400, statusMessage: 'meetingId is required.' })

  const db = useDrizzle()
  const [meeting] = await db.select({ id: schema.meetings.id })
    .from(schema.meetings).where(eq(schema.meetings.id, meetingId)).limit(1)
  if (!meeting) throw createError({ statusCode: 404, statusMessage: 'Meeting not found.' })

  // Recording someone else requires meeting-manager authority; members may only
  // mark themselves present.
  const isSelf = targetId === user.id
  if (!isSelf && !(await canRecordAttendance(user, meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'Only meeting managers can record attendance for others.' })
  }

  // The target must be a club member (members-only history; guests use check-in).
  const [target] = await db.select({ id: schema.users.id, status: schema.users.status })
    .from(schema.users).where(eq(schema.users.id, targetId)).limit(1)
  if (!target || !hasMinRole(target.status, 'member')) {
    throw createError({ statusCode: 400, statusMessage: 'Attendance is for club members only.' })
  }

  const [dupe] = await db.select()
    .from(schema.meetingAttendance)
    .where(and(
      eq(schema.meetingAttendance.meetingId, meetingId),
      eq(schema.meetingAttendance.userId, targetId),
    ))
    .limit(1)
  if (dupe) return { attendance: dupe, deduped: true }

  const [row] = await db.insert(schema.meetingAttendance)
    .values({
      meetingId,
      userId: targetId,
      source: isSelf ? 'self' : 'secretary',
      recordedBy: isSelf ? null : user.id,
    })
    .returning()
  return { attendance: row, deduped: false }
})
