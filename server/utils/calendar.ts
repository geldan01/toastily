import type { H3Event } from 'h3'

/**
 * Require permission to manage the calendar (PRD §3.1, §3.2): admins always;
 * otherwise the user must hold a calendar-managing executive position (e.g.
 * President, VP Education) or the delegable `calendar_manage` grant. Returns
 * the DB user. Throws 401/403.
 */
export async function requireCalendarManager(event: H3Event) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  const caps = await effectiveCapabilities(user)
  if (!caps.canManageCalendar) {
    throw createError({ statusCode: 403, statusMessage: 'Calendar-management permission required' })
  }
  return user
}
