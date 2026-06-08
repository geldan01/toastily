// Requires admin. Redirects non-admins to their account page, and
// unauthenticated visitors to login. Server routes enforce this too.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  const localePath = useLocalePath()
  if (!loggedIn.value) return navigateTo(localePath('/login'))
  if (!hasMinRole(user.value?.status, 'admin')) {
    return navigateTo(localePath('/account'))
  }
})
