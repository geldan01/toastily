import { and, eq, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Grant a delegable capability (`content_edit` / `calendar_manage`) to a member
 * (PRD §3, §13). Append/temporal — a new row with `grantedBy`; never overwrites
 * history. Idempotent: re-granting an already-active capability is a no-op.
 * Gated on the grant-management authority (admin or President).
 */
export default defineEventHandler(async (event) => {
  const actor = await requireGrantManager(event)
  const body = await readBody(event)

  const userId = String(body?.userId ?? '')
  const capability = body?.capability
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'userId is required.' })
  if (!isGrantableCapability(capability)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid capability is required.' })
  }

  const db = useDrizzle()
  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found.' })
  if (!hasMinRole(target.status, 'member')) {
    throw createError({ statusCode: 400, statusMessage: 'Only members can hold a delegable grant.' })
  }

  // Idempotent: don't stack duplicate active grants for the same capability.
  const [existing] = await db
    .select({ id: schema.permissionGrants.id })
    .from(schema.permissionGrants)
    .where(and(
      eq(schema.permissionGrants.userId, userId),
      eq(schema.permissionGrants.capability, capability),
      isNull(schema.permissionGrants.revokedAt),
    ))
    .limit(1)
  if (existing) return { grant: existing, alreadyGranted: true }

  const [row] = await db.insert(schema.permissionGrants).values({
    userId,
    capability,
    grantedBy: actor.id,
  }).returning()

  return { grant: row }
})
