import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Remove a member attendance mark (issue #35). A member may clear their own
 * presence; a meeting manager / secretary may clear anyone's (e.g. a mistaken
 * entry from the minutes). Identified by row `id`, or by `meetingId` + `userId`.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  if (!hasMinRole(user.status, 'member')) {
    throw createError({ statusCode: 403, statusMessage: 'Members only' })
  }

  const body = await readBody(event)
  const id = body?.id ? String(body.id) : ''
  const meetingId = body?.meetingId ? String(body.meetingId) : ''
  const userId = body?.userId ? String(body.userId) : ''
  if (!id && !(meetingId && userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Provide id, or meetingId and userId.' })
  }

  const db = useDrizzle()
  const [existing] = await db.select()
    .from(schema.meetingAttendance)
    .where(id
      ? eq(schema.meetingAttendance.id, id)
      : and(
          eq(schema.meetingAttendance.meetingId, meetingId),
          eq(schema.meetingAttendance.userId, userId),
        ))
    .limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Attendance record not found.' })

  if (existing.userId !== user.id && !(await canRecordAttendance(user, existing.meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'Only meeting managers can remove others’ attendance.' })
  }

  await db.delete(schema.meetingAttendance).where(eq(schema.meetingAttendance.id, existing.id))
  return { ok: true }
})
