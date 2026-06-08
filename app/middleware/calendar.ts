/**
 * Route guard for calendar management (PRD §3.1/§3.2): admin or a
 * calendar-managing executive position / grant. Redirects others to /account.
 */
export default defineNuxtRouteMiddleware(async () => {
  const localePath = useLocalePath()
  try {
    const caps = await useRequestFetch()('/api/me/capabilities') as { canManageCalendar: boolean }
    if (!caps?.canManageCalendar) return navigateTo(localePath('/account'))
  }
  catch {
    return navigateTo(localePath('/login'))
  }
})
