import { desc, eq, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Active (non-revoked) delegable permission grants, with the holder's and
 * granter's names, for the permissions admin UI (PRD §3, §13). Gated on the
 * grant-management authority (admin or President).
 */
export default defineEventHandler(async (event) => {
  await requireGrantManager(event)

  const granter = alias(schema.users, 'granter')
  const rows = await useDrizzle()
    .select({
      id: schema.permissionGrants.id,
      userId: schema.permissionGrants.userId,
      userName: schema.users.name,
      capability: schema.permissionGrants.capability,
      createdAt: schema.permissionGrants.createdAt,
      grantedByName: granter.name,
    })
    .from(schema.permissionGrants)
    .innerJoin(schema.users, eq(schema.users.id, schema.permissionGrants.userId))
    .leftJoin(granter, eq(granter.id, schema.permissionGrants.grantedBy))
    .where(isNull(schema.permissionGrants.revokedAt))
    .orderBy(desc(schema.permissionGrants.createdAt))

  return { grants: rows }
})
