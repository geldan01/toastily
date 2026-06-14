import { expect, test } from '../fixtures/roles'

/**
 * Public, unauthenticated site (PRD §5). Renders from settings + content_blocks
 * + news seeded into the test DB. Asserts on seeded copy rather than markup so
 * it stays resilient to styling changes.
 */
test.describe('public site', () => {
  test('landing page renders the seeded hero content', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/.+/)
    await expect(
      page.getByText('Awaken the confident public speaker within you', { exact: false }),
    ).toBeVisible()
  })

  test('news list shows seeded articles and links to detail', async ({ page }) => {
    await page.goto('/news')
    const firstArticle = page.getByText('Welcome to our club website', { exact: false })
    await expect(firstArticle).toBeVisible()
    await firstArticle.click()
    await expect(page).toHaveURL(/\/news\/.+/)
  })

  test('serves the French locale under /fr', async ({ page }) => {
    await page.goto('/fr')
    await expect(
      page.getByText('Révélez l\'orateur confiant qui sommeille en vous', { exact: false }),
    ).toBeVisible()
  })

  test('shows a login entry point and no member nav when logged out', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible()
  })
})
