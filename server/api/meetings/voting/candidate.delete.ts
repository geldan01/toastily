import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Remove a candidate from a ballot (PRD §8) — e.g. a table-topics entry added by
 * mistake. Cast ballots for that candidate cascade away. Meeting managers only.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })

  const body = await readBody(event)
  const candidateId = String(body?.candidateId ?? '')
  if (!candidateId) throw createError({ statusCode: 400, statusMessage: 'candidateId is required.' })

  const db = useDrizzle()
  const [cand] = await db.select({
    id: schema.voteCandidates.id,
    meetingId: schema.voteSessions.meetingId,
  })
    .from(schema.voteCandidates)
    .innerJoin(schema.voteSessions, eq(schema.voteSessions.id, schema.voteCandidates.sessionId))
    .where(eq(schema.voteCandidates.id, candidateId))
    .limit(1)
  if (!cand) throw createError({ statusCode: 404, statusMessage: 'Candidate not found.' })
  if (!(await isMeetingManager(user, cand.meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'Not permitted to manage voting for this meeting.' })
  }

  await db.delete(schema.voteCandidates).where(eq(schema.voteCandidates.id, candidateId))
  return { ok: true }
})
