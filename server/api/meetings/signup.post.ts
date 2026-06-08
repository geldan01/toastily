import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Claim or assign a meeting role (PRD §6.2).
 *  - A member claims an OPEN role for themselves.
 *  - A meeting manager (officer/admin OR the meeting's authority-role holder,
 *    e.g. the Toastmaster) may assign anyone: another member (`userId`) or a
 *    guest (`guestName`), and may reassign an already-filled role.
 * Members cannot self-claim a filled role, nor assign others. One occupant per
 * role per meeting (unique constraint).
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
  const [role] = await db.select({ id: schema.meetingRoles.id, active: schema.meetingRoles.active })
    .from(schema.meetingRoles).where(eq(schema.meetingRoles.id, roleId)).limit(1)
  if (!role || !role.active) throw createError({ statusCode: 404, statusMessage: 'Role not found.' })

  const canManage = await isMeetingManager(user, meetingId)

  // Resolve who fills the role.
  let targetUserId: string | null = user.id
  let guestName: string | null = null
  let assignedBy: string | null = null
  if (canManage && (body?.guestName || body?.userId)) {
    if (body.guestName) {
      const g = String(body.guestName).trim()
      if (!g) throw createError({ statusCode: 400, statusMessage: 'Guest name cannot be empty.' })
      targetUserId = null
      guestName = g
    }
    else {
      targetUserId = String(body.userId)
    }
    assignedBy = user.id
  }

  const [existing] = await db.select({ id: schema.meetingRoleSignups.id })
    .from(schema.meetingRoleSignups)
    .where(and(eq(schema.meetingRoleSignups.meetingId, meetingId), eq(schema.meetingRoleSignups.roleId, roleId)))
    .limit(1)

  if (existing) {
    if (!canManage) throw createError({ statusCode: 409, statusMessage: 'This role is already taken.' })
    const [row] = await db.update(schema.meetingRoleSignups)
      .set({ userId: targetUserId, guestName, assignedBy })
      .where(eq(schema.meetingRoleSignups.id, existing.id))
      .returning()
    return { signup: row }
  }

  const [row] = await db.insert(schema.meetingRoleSignups)
    .values({ meetingId, roleId, userId: targetUserId, guestName, assignedBy })
    .returning()
  return { signup: row }
})
