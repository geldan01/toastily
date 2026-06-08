import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Release a meeting role (PRD §6.2). A member may release a role they hold; a
 * meeting manager (officer/admin OR the meeting's authority-role holder, e.g.
 * the Toastmaster) may release anyone's signup.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  if (!hasMinRole(user.status, 'member')) {
    throw createError({ statusCode: 403, statusMessage: 'Members only' })
  }

  const body = await readBody(event)
  const meetingId = String(body?.meetingId ?? '')
  const roleId = String(body?.roleId ?? '')
  if (!meetingId || !roleId) throw createError({ statusCode: 400, statusMessage: 'meetingId and roleId are required.' })

  const db = useDrizzle()
  const [existing] = await db.select()
    .from(schema.meetingRoleSignups)
    .where(and(eq(schema.meetingRoleSignups.meetingId, meetingId), eq(schema.meetingRoleSignups.roleId, roleId)))
    .limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Nobody is signed up for this role.' })

  if (existing.userId !== user.id && !(await isMeetingManager(user, meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'You can only release your own role.' })
  }

  await db.delete(schema.meetingRoleSignups).where(eq(schema.meetingRoleSignups.id, existing.id))
  return { ok: true }
})
