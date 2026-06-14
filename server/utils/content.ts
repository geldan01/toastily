import type { H3Event } from 'h3'

/**
 * Require permission to manage content (PRD §3.1, §3.2): admins always;
 * otherwise the user must hold a content-managing executive position (e.g. VP
 * PR) or the delegable `content_edit` grant. Backs image uploads (issue #10)
 * and, later, News / content-block authoring. Returns the DB user. Throws
 * 401/403. Mirrors `requireCalendarManager`.
 */
export async function requireContentManager(event: H3Event) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  const caps = await effectiveCapabilities(user)
  if (!caps.canManageContent) {
    throw createError({ statusCode: 403, statusMessage: 'Content-management permission required' })
  }
  return user
}
