// Requires member-or-above (PRD §7.1 members section). Sends guests to their
// account page and unauthenticated visitors to login. Server routes enforce
// this too via requireMinRole(event, 'member').
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  const localePath = useLocalePath()
  if (!loggedIn.value) return navigateTo(localePath('/login'))
  if (!hasMinRole(user.value?.status, 'member')) {
    return navigateTo(localePath('/account'))
  }
})
