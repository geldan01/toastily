import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Remove a guest check-in (PRD §9). Meeting managers only (officer/admin OR the
 * meeting's authority-role holder, e.g. the Toastmaster/Sergeant-at-Arms) — used
 * to clear a mistaken or duplicate entry.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  if (!hasMinRole(user.status, 'member')) {
    throw createError({ statusCode: 403, statusMessage: 'Members only' })
  }

  const body = await readBody(event)
  const id = String(body?.id ?? '')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required.' })

  const db = useDrizzle()
  const [existing] = await db.select()
    .from(schema.guestCheckins).where(eq(schema.guestCheckins.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Check-in not found.' })

  if (!(await isMeetingManager(user, existing.meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'Only meeting managers can remove a check-in.' })
  }

  await db.delete(schema.guestCheckins).where(eq(schema.guestCheckins.id, id))
  return { ok: true }
})
