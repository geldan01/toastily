import type { H3Event } from 'h3'

/**
 * Require permission to manage club configuration (issue #47): admins always;
 * otherwise the user must hold a config-writing executive position (the
 * President by default). Backs the club-settings endpoints — the matrix governs
 * write access to the Configuration group. Returns the DB user. Throws 401/403.
 * Mirrors `requireContentManager`.
 */
export async function requireConfigManager(event: H3Event) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  const caps = await effectiveCapabilities(user)
  if (!caps.canManageConfig) {
    throw createError({ statusCode: 403, statusMessage: 'Configuration-management permission required' })
  }
  return user
}
