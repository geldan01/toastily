import { and, eq, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../db/client'
import type { User } from '../db/schema'

export interface Capabilities {
  canManageCalendar: boolean
  canManageContent: boolean
  canAssignOfficers: boolean
  canManageMinutes: boolean
}

/**
 * Capabilities a user holds via their CURRENT executive positions (PRD §3.2,
 * §3.1). Position capability flags are data, not hard-coded names. Admins are
 * handled by the caller (they implicitly hold everything).
 */
export async function executiveCapabilities(userId: string): Promise<Capabilities> {
  const rows = await useDrizzle()
    .select({
      cal: schema.executivePositions.canManageCalendar,
      content: schema.executivePositions.canManageContent,
      officers: schema.executivePositions.canAssignOfficers,
      minutes: schema.executivePositions.canManageMinutes,
    })
    .from(schema.executiveAssignments)
    .innerJoin(schema.executivePositions, eq(schema.executivePositions.id, schema.executiveAssignments.positionId))
    .where(and(
      eq(schema.executiveAssignments.userId, userId),
      isNull(schema.executiveAssignments.endedAt),
      eq(schema.executivePositions.active, true),
    ))

  return {
    canManageCalendar: rows.some(r => r.cal),
    canManageContent: rows.some(r => r.content),
    canAssignOfficers: rows.some(r => r.officers),
    canManageMinutes: rows.some(r => r.minutes),
  }
}

/**
 * Effective capabilities for a user, folding in admin (all) and the delegable
 * per-user grants (content_edit / calendar_manage) on top of executive
 * positions. The single source of truth for "can this user …" checks.
 */
export async function effectiveCapabilities(user: User): Promise<Capabilities> {
  if (user.status === 'admin') {
    return { canManageCalendar: true, canManageContent: true, canAssignOfficers: true, canManageMinutes: true }
  }
  const exec = await executiveCapabilities(user.id)
  return {
    canManageCalendar: exec.canManageCalendar || (await hasCapability(user.id, 'calendar_manage')),
    canManageContent: exec.canManageContent || (await hasCapability(user.id, 'content_edit')),
    canAssignOfficers: exec.canAssignOfficers,
    canManageMinutes: exec.canManageMinutes,
  }
}
