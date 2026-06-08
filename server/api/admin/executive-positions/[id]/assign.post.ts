import { and, eq, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../../db/client'

/**
 * Assign a member to an executive position (PRD §3.2). Allowed for admin or a
 * holder of a `canAssignOfficers` position (President). Ends any current holder
 * (kept as history) and records the new assignment. Promotes a plain member to
 * `officer` (officers are named from members) with a role-history entry.
 */
export default defineEventHandler(async (event) => {
  const actor = await getCurrentUser(event)
  if (!actor) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  const caps = await effectiveCapabilities(actor)
  if (!caps.canAssignOfficers) throw createError({ statusCode: 403, statusMessage: 'Only the President or an admin can assign officers.' })

  const positionId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const userId = String(body?.userId ?? '')
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'userId is required.' })

  const db = useDrizzle()
  const [position] = await db.select({ id: schema.executivePositions.id }).from(schema.executivePositions).where(eq(schema.executivePositions.id, positionId)).limit(1)
  if (!position) throw createError({ statusCode: 404, statusMessage: 'Position not found.' })

  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found.' })
  if (!hasMinRole(target.status, 'member')) {
    throw createError({ statusCode: 400, statusMessage: 'Only members can be assigned an executive position.' })
  }

  await db.transaction(async (tx) => {
    // End the current holder, if any (and not already this user).
    await tx.update(schema.executiveAssignments)
      .set({ endedAt: new Date() })
      .where(and(eq(schema.executiveAssignments.positionId, positionId), isNull(schema.executiveAssignments.endedAt)))

    await tx.insert(schema.executiveAssignments).values({ positionId, userId, assignedBy: actor.id })

    // Holding an executive position makes a member an officer.
    if (target.status === 'member') {
      await tx.update(schema.users).set({ status: 'officer' }).where(eq(schema.users.id, userId))
      await tx.insert(schema.roleHistory).values({
        userId,
        fromStatus: 'member',
        toStatus: 'officer',
        assignedBy: actor.id,
        note: 'Assigned an executive position',
      })
    }
  })

  return { ok: true }
})
