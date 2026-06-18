/**
 * Route guard for club-configuration management (issue #47): admin or a
 * config-writing executive position. Redirects others to /account.
 */
export default defineNuxtRouteMiddleware(async () => {
  const localePath = useLocalePath()
  try {
    const caps = await useRequestFetch()('/api/me/capabilities') as { canManageConfig: boolean }
    if (!caps?.canManageConfig) return navigateTo(localePath('/account'))
  }
  catch {
    return navigateTo(localePath('/login'))
  }
})
