/**
 * Route guard for communication management (issue #47): admin or a
 * communication-writing executive position. Redirects others to /account.
 */
export default defineNuxtRouteMiddleware(async () => {
  const localePath = useLocalePath()
  try {
    const caps = await useRequestFetch()('/api/me/capabilities') as { canManageCommunication: boolean }
    if (!caps?.canManageCommunication) return navigateTo(localePath('/account'))
  }
  catch {
    return navigateTo(localePath('/login'))
  }
})
