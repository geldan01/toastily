// Protects a page: redirects to /login when not authenticated.
// Usage: definePageMeta({ middleware: 'auth' })
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  const localePath = useLocalePath()
  if (!loggedIn.value) {
    return navigateTo(localePath('/login'))
  }
})
