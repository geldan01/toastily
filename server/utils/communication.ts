import type { H3Event } from 'h3'
import { SIGNUP_REMINDER_TEMPLATE_KEY } from './notifications'

/**
 * Require permission to manage communication (issue #47): admins always;
 * otherwise the user must hold a communication-writing executive position (e.g.
 * VP PR or President). Backs the email/notification endpoints — members can
 * always view, the matrix only governs write access. Returns the DB user.
 * Throws 401/403. Mirrors `requireContentManager`.
 */
export async function requireCommunicationManager(event: H3Event) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  const caps = await effectiveCapabilities(user)
  if (!caps.canManageCommunication) {
    throw createError({ statusCode: 403, statusMessage: 'Communication-management permission required' })
  }
  return user
}

/**
 * Require communication **or** calendar (agenda) management. The notifications
 * page is reachable by both, because the signup reminder — the "open roles &
 * speech slots" nudge — is an agenda concern owned by calendar managers (issue
 * #59), while everything else stays communication-only (enforced per write).
 */
export async function requireCommunicationOrCalendarManager(event: H3Event) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  const caps = await effectiveCapabilities(user)
  if (!caps.canManageCommunication && !caps.canManageCalendar) {
    throw createError({ statusCode: 403, statusMessage: 'Communication- or calendar-management permission required' })
  }
  return user
}

/**
 * Require permission to manage the email **schedule** for a given template
 * (issue #59). The signup-reminder schedule may be managed by communication OR
 * calendar managers; every other template's schedule stays communication-only.
 */
export async function requireScheduleManager(event: H3Event, templateKey: string) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  const caps = await effectiveCapabilities(user)
  const allowed = caps.canManageCommunication
    || (templateKey === SIGNUP_REMINDER_TEMPLATE_KEY && caps.canManageCalendar)
  if (!allowed) {
    throw createError({ statusCode: 403, statusMessage: 'Schedule-management permission required' })
  }
  return user
}
