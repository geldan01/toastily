import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Close a ballot (PRD §8) — results become visible to meeting managers. The
 * opener can reopen later (POST open) to fix mistakes. Meeting managers only.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })

  const body = await readBody(event)
  const sessionId = String(body?.sessionId ?? '')
  if (!sessionId) throw createError({ statusCode: 400, statusMessage: 'sessionId is required.' })

  const db = useDrizzle()
  const [session] = await db.select()
    .from(schema.voteSessions).where(eq(schema.voteSessions.id, sessionId)).limit(1)
  if (!session) throw createError({ statusCode: 404, statusMessage: 'Ballot not found.' })
  if (!(await isMeetingManager(user, session.meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'Not permitted to manage voting for this meeting.' })
  }

  const [row] = await db.update(schema.voteSessions)
    .set({ status: 'closed', closedBy: user.id, closedAt: new Date() })
    .where(eq(schema.voteSessions.id, sessionId))
    .returning()
  return { session: row }
})
