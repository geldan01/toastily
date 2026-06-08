import { inArray } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Close ballot(s) (PRD §8) — results become visible to meeting managers. Accepts
 * an array of session ids so the two Table Topics ballots close with one click;
 * speech ballots send one. The opener can reopen later (POST open) to fix
 * mistakes. Meeting managers only (validated per session's meeting).
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })

  const body = await readBody(event)
  const sessionIds = (Array.isArray(body?.sessionIds) ? body.sessionIds : [])
    .map(String)
    .filter(Boolean)
  if (!sessionIds.length) throw createError({ statusCode: 400, statusMessage: 'sessionIds is required.' })

  const db = useDrizzle()
  const found = await db.select()
    .from(schema.voteSessions)
    .where(inArray(schema.voteSessions.id, sessionIds))
  if (found.length !== sessionIds.length) {
    throw createError({ statusCode: 404, statusMessage: 'Ballot not found.' })
  }
  for (const session of found) {
    if (!(await isMeetingManager(user, session.meetingId))) {
      throw createError({ statusCode: 403, statusMessage: 'Not permitted to manage voting for this meeting.' })
    }
  }

  const sessions = await db.update(schema.voteSessions)
    .set({ status: 'closed', closedBy: user.id, closedAt: new Date() })
    .where(inArray(schema.voteSessions.id, sessionIds))
    .returning()
  return { sessions }
})
