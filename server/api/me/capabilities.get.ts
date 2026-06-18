/**
 * The current user's effective capabilities (PRD §3.1/§3.2), for showing/hiding
 * management UI. Guests/anonymous get all-false. The server still enforces each
 * capability independently — this only drives visibility.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) return { ...NO_CAPABILITIES }
  return await effectiveCapabilities(user)
})
