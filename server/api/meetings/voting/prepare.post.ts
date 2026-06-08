import { and, eq, inArray } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Prepare ballot(s) for a meeting (PRD §8) — the "Manage candidates" /
 * "Sync from speeches" action. Ensures a `draft` vote session exists for each
 * requested category, then **additively** pulls in the speech-category
 * candidates (speakers → Best Speaker, evaluators → Best Evaluator); table-topics
 * drafts start empty for the manager to fill live. Safe to call repeatedly: an
 * existing session keeps its status and votes, and candidates already on the
 * ballot are never duplicated — so this also surfaces speakers added after the
 * ballot was first prepared. The Table Topics card sends both TT categories at
 * once. Meeting managers only.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })

  const body = await readBody(event)
  const meetingId = String(body?.meetingId ?? '')
  const categories = (Array.isArray(body?.categories) ? body.categories : [])
    .map(String)
    .filter((c: string) => VOTE_CATEGORIES.includes(c as (typeof VOTE_CATEGORIES)[number])) as (typeof VOTE_CATEGORIES)[number][]
  if (!meetingId || !categories.length) {
    throw createError({ statusCode: 400, statusMessage: 'meetingId and at least one valid category are required.' })
  }
  if (!(await isMeetingManager(user, meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'Not permitted to manage voting for this meeting.' })
  }

  const db = useDrizzle()
  const existing = await db.select()
    .from(schema.voteSessions)
    .where(and(
      eq(schema.voteSessions.meetingId, meetingId),
      inArray(schema.voteSessions.category, categories),
    ))
  const existingByCategory = new Map(existing.map(s => [s.category, s]))

  const sessions = []
  for (const category of categories) {
    let session = existingByCategory.get(category)
    if (!session) {
      // Draft only — `openedBy`/`openedAt` are stamped when the ballot is opened.
      const [created] = await db.insert(schema.voteSessions)
        .values({ meetingId, category, status: 'draft' })
        .returning()
      if (!created) continue
      session = created
    }
    // Additively pull in the meeting's speakers/evaluators (no-op for table
    // topics, and never re-adds someone already on the ballot).
    await syncDerivedCandidates(db, session.id, meetingId, category)
    sessions.push(session)
  }
  return { sessions }
})
