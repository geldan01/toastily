import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Cast (or change) a vote (PRD §8). Public — anyone present votes once per
 * category; identity is the anonymous per-device cookie token. Only while the
 * ballot is open. Re-voting updates the chosen candidate (still one ballot per
 * device, enforced by the unique session+token constraint).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const sessionId = String(body?.sessionId ?? '')
  const candidateId = String(body?.candidateId ?? '')
  if (!sessionId || !candidateId) {
    throw createError({ statusCode: 400, statusMessage: 'sessionId and candidateId are required.' })
  }

  const db = useDrizzle()
  const [session] = await db.select({ id: schema.voteSessions.id, status: schema.voteSessions.status })
    .from(schema.voteSessions).where(eq(schema.voteSessions.id, sessionId)).limit(1)
  if (!session) throw createError({ statusCode: 404, statusMessage: 'Ballot not found.' })
  if (session.status !== 'open') throw createError({ statusCode: 409, statusMessage: 'Voting is closed.' })

  // Candidate must belong to this ballot.
  const [candidate] = await db.select({ id: schema.voteCandidates.id })
    .from(schema.voteCandidates)
    .where(and(eq(schema.voteCandidates.id, candidateId), eq(schema.voteCandidates.sessionId, sessionId)))
    .limit(1)
  if (!candidate) throw createError({ statusCode: 404, statusMessage: 'Candidate not found for this ballot.' })

  const token = getOrSetVoterToken(event)
  await db.insert(schema.voteBallots)
    .values({ sessionId, candidateId, voterToken: token })
    .onConflictDoUpdate({
      target: [schema.voteBallots.sessionId, schema.voteBallots.voterToken],
      set: { candidateId },
    })
  return { ok: true, candidateId }
})
