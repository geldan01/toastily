import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Add a candidate to a ballot (PRD §8) — a member (`userId`) or a guest
 * (`guestName`). Used by the meeting manager to enter table-topics participants
 * live, or add the Grammarian / a guest evaluator to the Best Evaluator ballot.
 * Meeting managers only.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })

  const body = await readBody(event)
  const sessionId = String(body?.sessionId ?? '')
  if (!sessionId) throw createError({ statusCode: 400, statusMessage: 'sessionId is required.' })

  let userId: string | null = null
  let guestName: string | null = null
  if (body?.guestName) {
    const g = String(body.guestName).trim()
    if (!g) throw createError({ statusCode: 400, statusMessage: 'Guest name cannot be empty.' })
    guestName = g
  }
  else if (body?.userId) {
    userId = String(body.userId)
  }
  else {
    throw createError({ statusCode: 400, statusMessage: 'A member (userId) or guestName is required.' })
  }

  const db = useDrizzle()
  const [session] = await db.select()
    .from(schema.voteSessions).where(eq(schema.voteSessions.id, sessionId)).limit(1)
  if (!session) throw createError({ statusCode: 404, statusMessage: 'Ballot not found.' })
  if (!(await isMeetingManager(user, session.meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'Not permitted to manage voting for this meeting.' })
  }

  const [row] = await db.insert(schema.voteCandidates)
    .values({ sessionId, userId, guestName })
    .returning()
  return { candidate: row }
})
