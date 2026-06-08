import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../db/client'
import type { AccountStatus } from '#shared/utils/roles'

type Principal = { id: string, status: AccountStatus } | null | undefined

/**
 * Whether a user may manage signups for a given meeting (PRD §3, contextual
 * authority). True for officers/admin globally, and for the member who holds a
 * role flagged `grantsMeetingAuthority` on that meeting (e.g. the Toastmaster).
 * Such a manager can assign any member or guest, reassign, and release anyone's
 * signup — independent of executive rank.
 *
 * Authority is data, never a hard-coded role name: it derives from the role's
 * flag, so a club decides which role(s) confer it.
 */
export async function isMeetingManager(user: Principal, meetingId: string): Promise<boolean> {
  if (!user) return false
  if (hasMinRole(user.status, 'officer')) return true

  const [row] = await useDrizzle()
    .select({ id: schema.meetingRoleSignups.id })
    .from(schema.meetingRoleSignups)
    .innerJoin(schema.meetingRoles, eq(schema.meetingRoles.id, schema.meetingRoleSignups.roleId))
    .where(and(
      eq(schema.meetingRoleSignups.meetingId, meetingId),
      eq(schema.meetingRoleSignups.userId, user.id),
      eq(schema.meetingRoles.grantsMeetingAuthority, true),
    ))
    .limit(1)
  return !!row
}
