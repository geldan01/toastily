import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Strike out (or restore) a candidate on a ballot (PRD §8) — e.g. a speaker who
 * ran over time. Unlike DELETE, this keeps the row and any cast votes; the
 * candidate is just marked `excluded` so they're non-votable and never count as a
 * winner. Meeting managers only.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })

  const body = await readBody(event)
  const candidateId = String(body?.candidateId ?? '')
  if (!candidateId) throw createError({ statusCode: 400, statusMessage: 'candidateId is required.' })
  const excluded = Boolean(body?.excluded)

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

  const [row] = await db.update(schema.voteCandidates)
    .set({ excluded })
    .where(eq(schema.voteCandidates.id, candidateId))
    .returning()
  return { candidate: row }
})
