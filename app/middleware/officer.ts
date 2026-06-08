// Requires officer-or-above. Redirects guests/members to their account page,
// and unauthenticated visitors to login. Server routes enforce this too.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  const localePath = useLocalePath()
  if (!loggedIn.value) return navigateTo(localePath('/login'))
  if (!hasMinRole(user.value?.status, 'officer')) {
    return navigateTo(localePath('/account'))
  }
})
