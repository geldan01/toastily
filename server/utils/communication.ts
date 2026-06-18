import type { H3Event } from 'h3'

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
