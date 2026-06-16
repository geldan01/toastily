import { and, eq, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Revoke a delegable grant (PRD §3, §13). Soft revoke — sets `revokedAt` so the
 * capability is dropped immediately while the grant history is preserved (never
 * hard-deleted). Gated on the grant-management authority (admin or President).
 */
export default defineEventHandler(async (event) => {
  await requireGrantManager(event)
  const id = getRouterParam(event, 'id')!

  const [row] = await useDrizzle()
    .update(schema.permissionGrants)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.permissionGrants.id, id), isNull(schema.permissionGrants.revokedAt)))
    .returning({ id: schema.permissionGrants.id })

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Active grant not found.' })
  return { ok: true }
})
