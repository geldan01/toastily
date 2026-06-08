import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Delete an executive position (admin). Blocked when it has any assignment
 * history (cascade would erase role-allocation history) — deactivate instead.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')
  const id = getRouterParam(event, 'id')!
  const db = useDrizzle()

  const [assigned] = await db.select({ id: schema.executiveAssignments.id })
    .from(schema.executiveAssignments)
    .where(eq(schema.executiveAssignments.positionId, id))
    .limit(1)
  if (assigned) {
    throw createError({ statusCode: 409, statusMessage: 'This position has assignment history. Deactivate it instead of deleting.' })
  }

  const [row] = await db.delete(schema.executivePositions).where(eq(schema.executivePositions.id, id)).returning({ id: schema.executivePositions.id })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Position not found.' })
  return { ok: true }
})
