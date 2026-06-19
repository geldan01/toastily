import { and, eq, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Revoke a member's status (issue #50) — e.g. non-renewal. No reason required.
 * Demotes member/officer → guest, ends any current executive assignments (kept
 * as history), and records the change in `role_history` (who did it, when) for
 * audit. Admins cannot be revoked here; you cannot revoke yourself.
 *
 * Authority is data-driven: admin or a `canAssignOfficers` (people) position —
 * the same people-management capability that governs officer assignment.
 */
export default defineEventHandler(async (event) => {
  const actor = await requirePeopleManager(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  if (id === actor.id) throw createError({ statusCode: 400, statusMessage: 'You cannot revoke your own membership.' })

  const db = useDrizzle()
  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
  if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found.' })
  if (target.status === 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admins cannot be revoked.' })
  }
  if (!hasMinRole(target.status, 'member')) {
    throw createError({ statusCode: 400, statusMessage: 'This account is not a member.' })
  }

  await db.transaction(async (tx) => {
    // End any current executive positions (kept as history).
    await tx.update(schema.executiveAssignments)
      .set({ endedAt: new Date() })
      .where(and(eq(schema.executiveAssignments.userId, id), isNull(schema.executiveAssignments.endedAt)))

    await tx.update(schema.users).set({ status: 'guest' }).where(eq(schema.users.id, id))

    await tx.insert(schema.roleHistory).values({
      userId: id,
      fromStatus: target.status,
      toStatus: 'guest',
      assignedBy: actor.id,
      note: 'Membership revoked',
    })
  })

  return { ok: true }
})
