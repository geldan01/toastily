import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Release a speech speaker/evaluator (PRD §6.3). A member may release a slot
 * they hold; a meeting manager (officer/admin OR the meeting's authority-role
 * holder, e.g. the Toastmaster) may release anyone's. If the speech row is left
 * entirely empty (no title, speaker, or evaluator) it is removed.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  if (!hasMinRole(user.status, 'member')) throw createError({ statusCode: 403, statusMessage: 'Members only' })

  const body = await readBody(event)
  const meetingId = String(body?.meetingId ?? '')
  const slot = Number(body?.slot)
  const field = body?.field === 'evaluator' ? 'evaluator' : 'speaker'
  if (!meetingId || !Number.isInteger(slot) || slot < 1) {
    throw createError({ statusCode: 400, statusMessage: 'meetingId and a valid slot are required.' })
  }

  const db = useDrizzle()
  const [existing] = await db.select().from(schema.speeches)
    .where(and(eq(schema.speeches.meetingId, meetingId), eq(schema.speeches.slot, slot)))
    .limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Nothing to release.' })

  const heldUserId = field === 'speaker' ? existing.presenterUserId : existing.evaluatorUserId
  if (heldUserId !== user.id && !(await isMeetingManager(user, meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'You can only release your own slot.' })
  }

  const cleared = field === 'speaker'
    ? { presenterUserId: null, presenterGuestName: null }
    : { evaluatorUserId: null, evaluatorGuestName: null }
  const next = { ...existing, ...cleared }

  // Drop the row if it becomes completely empty.
  if (!next.title && !next.presenterUserId && !next.presenterGuestName && !next.evaluatorUserId && !next.evaluatorGuestName) {
    await db.delete(schema.speeches).where(eq(schema.speeches.id, existing.id))
    return { ok: true, removed: true }
  }
  await db.update(schema.speeches).set(cleared).where(eq(schema.speeches.id, existing.id))
  return { ok: true }
})
