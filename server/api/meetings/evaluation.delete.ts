import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Retract a written evaluation (issue #60). A member may delete their own
 * evaluation; a meeting manager may delete any for that meeting. Guests have no
 * stable identity, so they cannot delete (they re-submit to correct instead).
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user || !hasMinRole(user.status, 'member')) {
    throw createError({ statusCode: 403, statusMessage: 'Members only' })
  }

  const body = await readBody(event)
  const id = String(body?.id ?? '')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required.' })

  const db = useDrizzle()
  const [row] = await db.select({
    id: schema.writtenEvaluations.id,
    meetingId: schema.writtenEvaluations.meetingId,
    evaluatorUserId: schema.writtenEvaluations.evaluatorUserId,
  })
    .from(schema.writtenEvaluations).where(eq(schema.writtenEvaluations.id, id)).limit(1)
  if (!row) return { ok: true }

  const isOwn = row.evaluatorUserId === user.id
  if (!isOwn && !(await isMeetingManager(user, row.meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'You can only retract your own evaluation.' })
  }

  await db.delete(schema.writtenEvaluations).where(eq(schema.writtenEvaluations.id, id))
  return { ok: true }
})
