/**
 * Route guard for the notifications page (issue #59): communication managers get
 * the full page; calendar (agenda) managers reach it too, but only to configure
 * the signup-reminder schedule (the page scopes the rest to communication
 * managers). Others are redirected to /account.
 */
export default defineNuxtRouteMiddleware(async () => {
  const localePath = useLocalePath()
  try {
    const caps = await useRequestFetch()('/api/me/capabilities') as {
      canManageCommunication: boolean
      canManageCalendar: boolean
    }
    if (!caps?.canManageCommunication && !caps?.canManageCalendar) {
      return navigateTo(localePath('/account'))
    }
  }
  catch {
    return navigateTo(localePath('/login'))
  }
})
