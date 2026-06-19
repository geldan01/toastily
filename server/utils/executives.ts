import type { H3Event } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../db/client'
import type { User } from '../db/schema'

/**
 * Effective capabilities a user holds. Each concrete capability is derived from
 * the per-group write access of the user's executive positions (issue #47) — the
 * matrix's five columns — folded together with the delegable per-user grants and
 * admin (who holds everything). The single source of truth for "can this user …"
 * checks; the server enforces each one independently.
 */
export interface Capabilities {
  canManageCalendar: boolean
  canManageContent: boolean
  canAssignOfficers: boolean
  canManageMinutes: boolean
  canManageCommunication: boolean
  canManageConfig: boolean
}

/** All-true / all-false capability sets (admin / anonymous). */
export const ALL_CAPABILITIES: Capabilities = {
  canManageCalendar: true,
  canManageContent: true,
  canAssignOfficers: true,
  canManageMinutes: true,
  canManageCommunication: true,
  canManageConfig: true,
}
export const NO_CAPABILITIES: Capabilities = {
  canManageCalendar: false,
  canManageContent: false,
  canAssignOfficers: false,
  canManageMinutes: false,
  canManageCommunication: false,
  canManageConfig: false,
}

interface GroupWrite {
  people: boolean
  meetings: boolean
  content: boolean
  communication: boolean
  config: boolean
}

/**
 * Per-group write access the user holds via their CURRENT executive positions
 * (PRD §3.2). Group flags are data, not hard-coded names. Admins are handled by
 * the caller (they implicitly hold everything).
 */
async function executiveGroupWrite(userId: string): Promise<GroupWrite> {
  const rows = await useDrizzle()
    .select({
      people: schema.executivePositions.writePeople,
      meetings: schema.executivePositions.writeMeetings,
      content: schema.executivePositions.writeContent,
      communication: schema.executivePositions.writeCommunication,
      config: schema.executivePositions.writeConfig,
    })
    .from(schema.executiveAssignments)
    .innerJoin(schema.executivePositions, eq(schema.executivePositions.id, schema.executiveAssignments.positionId))
    .where(and(
      eq(schema.executiveAssignments.userId, userId),
      isNull(schema.executiveAssignments.endedAt),
      eq(schema.executivePositions.active, true),
    ))

  return {
    people: rows.some(r => r.people),
    meetings: rows.some(r => r.meetings),
    content: rows.some(r => r.content),
    communication: rows.some(r => r.communication),
    config: rows.some(r => r.config),
  }
}

/**
 * Capabilities held via executive positions only (no admin, no delegable
 * grants). Each concrete capability maps onto the group that owns its tools.
 */
export async function executiveCapabilities(userId: string): Promise<Capabilities> {
  const g = await executiveGroupWrite(userId)
  return {
    canManageCalendar: g.meetings,
    canManageMinutes: g.meetings,
    canManageContent: g.content,
    canAssignOfficers: g.people,
    canManageCommunication: g.communication,
    canManageConfig: g.config,
  }
}

/**
 * Effective capabilities for a user, folding in admin (all) and the delegable
 * per-user grants (content_edit / calendar_manage) on top of executive
 * positions. The single source of truth for "can this user …" checks.
 */
export async function effectiveCapabilities(user: User): Promise<Capabilities> {
  if (user.status === 'admin') return { ...ALL_CAPABILITIES }
  const exec = await executiveCapabilities(user.id)
  return {
    canManageCalendar: exec.canManageCalendar || (await hasCapability(user.id, 'calendar_manage')),
    canManageContent: exec.canManageContent || (await hasCapability(user.id, 'content_edit')),
    canAssignOfficers: exec.canAssignOfficers,
    canManageMinutes: exec.canManageMinutes,
    canManageCommunication: exec.canManageCommunication,
    canManageConfig: exec.canManageConfig,
  }
}

/**
 * Require permission to manage people (PRD §3, issue #50): admin or a holder of a
 * `canAssignOfficers` (people-group) executive position. Authority is data, never
 * a hard-coded position name. Returns the DB actor; throws 401/403. Mirrors
 * `requireGrantManager` — used for officer assignment and member revocation.
 */
export async function requirePeopleManager(event: H3Event): Promise<User> {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  const caps = await effectiveCapabilities(user)
  if (!caps.canAssignOfficers) {
    throw createError({ statusCode: 403, statusMessage: 'Only the President or an admin can manage members.' })
  }
  return user
}
