/**
 * Route guard for content management (PRD §3.1/§3.2): admin or a
 * content-managing executive position / grant (e.g. VP PR). Redirects others to
 * /account. Mirrors the `calendar` middleware; backs the News authoring pages.
 */
export default defineNuxtRouteMiddleware(async () => {
  const localePath = useLocalePath()
  try {
    const caps = await useRequestFetch()('/api/me/capabilities') as { canManageContent: boolean }
    if (!caps?.canManageContent) return navigateTo(localePath('/account'))
  }
  catch {
    return navigateTo(localePath('/login'))
  }
})
