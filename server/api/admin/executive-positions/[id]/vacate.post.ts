import { and, eq, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../../db/client'

/**
 * Vacate an executive position (PRD §3.2): end the current assignment, keeping
 * it as history. Account status is left unchanged (demotion, if any, is a
 * separate deliberate action). Allowed for admin or a President.
 */
export default defineEventHandler(async (event) => {
  const actor = await getCurrentUser(event)
  if (!actor) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  const caps = await effectiveCapabilities(actor)
  if (!caps.canAssignOfficers) throw createError({ statusCode: 403, statusMessage: 'Only the President or an admin can change officers.' })

  const positionId = getRouterParam(event, 'id')!
  const [row] = await useDrizzle().update(schema.executiveAssignments)
    .set({ endedAt: new Date() })
    .where(and(eq(schema.executiveAssignments.positionId, positionId), isNull(schema.executiveAssignments.endedAt)))
    .returning({ id: schema.executiveAssignments.id })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'This position has no current holder.' })
  return { ok: true }
})
