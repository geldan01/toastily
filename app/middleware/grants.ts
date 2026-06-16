/**
 * Route guard for managing delegable permission grants (PRD §3, §13): admin or
 * a holder of a `canAssignOfficers` position (President). Redirects others to
 * /account. Mirrors the `calendar` / `content` middleware.
 */
export default defineNuxtRouteMiddleware(async () => {
  const localePath = useLocalePath()
  try {
    const caps = await useRequestFetch()('/api/me/capabilities') as { canAssignOfficers: boolean }
    if (!caps?.canAssignOfficers) return navigateTo(localePath('/account'))
  }
  catch {
    return navigateTo(localePath('/login'))
  }
})
