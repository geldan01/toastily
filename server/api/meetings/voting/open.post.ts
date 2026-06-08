import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Open (or reopen) a ballot for a meeting + category (PRD §8). Restricted to
 * meeting managers (officer/admin OR the meeting's Sergeant-at-Arms / Toastmaster
 * — authority is data via the role flag). Reopening a closed ballot flips it back
 * to `open` and keeps cast votes. On first open of a speech category, candidates
 * are pre-filled from the meeting's speeches; table-topics ballots start empty.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })

  const body = await readBody(event)
  const meetingId = String(body?.meetingId ?? '')
  const category = String(body?.category ?? '') as (typeof VOTE_CATEGORIES)[number]
  if (!meetingId || !VOTE_CATEGORIES.includes(category)) {
    throw createError({ statusCode: 400, statusMessage: 'meetingId and a valid category are required.' })
  }
  if (!(await isMeetingManager(user, meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'Not permitted to manage voting for this meeting.' })
  }

  const db = useDrizzle()
  const [existing] = await db.select()
    .from(schema.voteSessions)
    .where(and(eq(schema.voteSessions.meetingId, meetingId), eq(schema.voteSessions.category, category)))
    .limit(1)

  if (existing) {
    const [row] = await db.update(schema.voteSessions)
      .set({ status: 'open', openedBy: user.id, openedAt: new Date(), closedBy: null, closedAt: null })
      .where(eq(schema.voteSessions.id, existing.id))
      .returning()
    return { session: row }
  }

  const [session] = await db.insert(schema.voteSessions)
    .values({ meetingId, category, status: 'open', openedBy: user.id })
    .returning()

  // Seed speech-category candidates from the meeting's speeches.
  const derived = await deriveCandidates(db, meetingId, category)
  if (derived.length) {
    await db.insert(schema.voteCandidates)
      .values(derived.map(c => ({ sessionId: session.id, userId: c.userId, guestName: c.guestName })))
  }
  return { session }
})
