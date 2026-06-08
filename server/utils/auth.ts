import type { H3Event } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../db/client'
import type { User } from '../db/schema'
import type { AccountStatus } from '#shared/utils/roles'

/** Map a DB user row to the safe fields stored in the session cookie. */
export function toSessionUser(u: User) {
  return { id: u.id, name: u.name, email: u.email, status: u.status, locale: u.locale }
}

/**
 * Load the current user fresh from the DB (status may have changed since the
 * session cookie was issued — e.g. after a promotion). Returns null if not
 * authenticated or the user no longer exists.
 */
export async function getCurrentUser(event: H3Event) {
  const { user } = await getUserSession(event)
  if (!user?.id) return null
  const rows = await useDrizzle()
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Require an authenticated user whose account status is at least `min`.
 * Throws 401 if unauthenticated, 403 if under-privileged. Returns the DB user.
 */
export async function requireMinRole(event: H3Event, min: AccountStatus) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  if (!hasMinRole(user.status, min)) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' })
  }
  return user
}

/**
 * Whether a user holds a delegable capability (PRD §3.1). Admins implicitly
 * have every capability; otherwise an active (non-revoked) grant is required.
 */
export async function hasCapability(
  userId: string,
  cap: 'content_edit' | 'calendar_manage',
): Promise<boolean> {
  const rows = await useDrizzle()
    .select({ id: schema.permissionGrants.id })
    .from(schema.permissionGrants)
    .where(and(
      eq(schema.permissionGrants.userId, userId),
      eq(schema.permissionGrants.capability, cap),
      isNull(schema.permissionGrants.revokedAt),
    ))
    .limit(1)
  return rows.length > 0
}
