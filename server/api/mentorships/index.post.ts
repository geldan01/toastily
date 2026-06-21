import { and, eq, inArray, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Create a mentorship pairing (PRD §11, issue #62). Gated on the people-group
 * capability via `requirePeopleManager` (admin or a `canAssignOfficers` holder)
 * — authority is data, never a hard-coded position name. A mentee has at most
 * one current mentor, so any existing active pairing for the mentee is ended
 * (kept as history) before the new one is recorded.
 */
export default defineEventHandler(async (event) => {
  const actor = await requirePeopleManager(event)

  const body = await readBody(event)
  const mentorUserId = String(body?.mentorUserId ?? '')
  const menteeUserId = String(body?.menteeUserId ?? '')
  if (!mentorUserId || !menteeUserId) {
    throw createError({ statusCode: 400, statusMessage: 'mentorUserId and menteeUserId are required.' })
  }
  if (mentorUserId === menteeUserId) {
    throw createError({ statusCode: 400, statusMessage: 'A member cannot mentor themselves.' })
  }

  const db = useDrizzle()
  const people = await db.select({ id: schema.users.id, status: schema.users.status })
    .from(schema.users)
    .where(inArray(schema.users.id, [mentorUserId, menteeUserId]))
  const mentor = people.find(p => p.id === mentorUserId)
  const mentee = people.find(p => p.id === menteeUserId)
  if (!mentor || !mentee) {
    throw createError({ statusCode: 404, statusMessage: 'Mentor or mentee not found.' })
  }
  if (!hasMinRole(mentor.status, 'member') || !hasMinRole(mentee.status, 'member')) {
    throw createError({ statusCode: 400, statusMessage: 'Both the mentor and the mentee must be members.' })
  }

  const id = await db.transaction(async (tx) => {
    // A mentee has at most one current mentor — end any active pairing first.
    await tx.update(schema.mentorships)
      .set({ endedAt: new Date() })
      .where(and(
        eq(schema.mentorships.menteeUserId, menteeUserId),
        isNull(schema.mentorships.endedAt),
      ))

    const [row] = await tx.insert(schema.mentorships)
      .values({ mentorUserId, menteeUserId, assignedBy: actor.id })
      .returning({ id: schema.mentorships.id })
    return row!.id
  })

  return { ok: true, id }
})
