import type { H3Event } from 'h3'

/** The delegable per-user capabilities that can be granted/revoked (PRD §3.1). */
export const GRANTABLE_CAPABILITIES = ['content_edit', 'calendar_manage'] as const
export type GrantableCapability = (typeof GRANTABLE_CAPABILITIES)[number]

export function isGrantableCapability(value: unknown): value is GrantableCapability {
  return typeof value === 'string' && (GRANTABLE_CAPABILITIES as readonly string[]).includes(value)
}

/**
 * Require permission to manage delegable grants (PRD §3, §13): admin or a holder
 * of a `canAssignOfficers` executive position (President). Authority is data
 * (capabilities), never a hard-coded position name. Returns the DB actor.
 * Throws 401/403. Mirrors `requireContentManager` / `requireCalendarManager`.
 */
export async function requireGrantManager(event: H3Event) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  const caps = await effectiveCapabilities(user)
  if (!caps.canAssignOfficers) {
    throw createError({ statusCode: 403, statusMessage: 'Only the President or an admin can manage permissions.' })
  }
  return user
}
