import { expect, gotoReady, test } from '../fixtures/roles'

/**
 * Auth UI flow (PRD §4). Login through the real form, plus the route-guard
 * redirect for an unauthenticated visitor. The register → email-confirm → login
 * pipeline is covered at the API layer (tests/integration/auth-api.spec.ts),
 * where the verification token can be read from the DB.
 */
test.describe('authentication', () => {
  test('a member can log in through the form', async ({ page, accounts }) => {
    await gotoReady(page, '/login')
    await page.locator('#email').fill(accounts.member.email)
    await page.locator('#password').fill(accounts.member.password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/account/)
  })

  test('wrong password shows an error and stays on the login page', async ({ page, accounts }) => {
    await gotoReady(page, '/login')
    await page.locator('#email').fill(accounts.member.email)
    await page.locator('#password').fill('wrong-password')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByText(/something went wrong|invalid/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('registering shows the branded confirmation with login + home links', async ({ page }) => {
    await gotoReady(page, '/register')
    await page.locator('#name').fill('Branded Newcomer')
    // Unique email so the run is idempotent against a reused test DB.
    await page.locator('#email').fill(`newcomer-${Date.now()}@toastily.test`)
    await page.locator('#password').fill('supersecret123')
    await page.locator('#consent').check()
    await page.getByRole('button', { name: 'Create account' }).click()

    // The bare message is replaced by a branded panel (issue #53).
    await expect(page.getByText(/You're almost there/)).toBeVisible()
    await expect(page.getByText(/Check your email/i)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', /\/login$/)
    await expect(page.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', /\/$/)
  })

  test('unauthenticated visit to a member page redirects to login', async ({ guestPage }) => {
    await guestPage.goto('/members')
    await expect(guestPage).toHaveURL(/\/login/)
  })

  test('an authenticated member sees the members area in the account menu', async ({ memberPage, accounts }) => {
    await gotoReady(memberPage, '/')
    // The members link lives in the account dropdown, keyed by the user's name.
    await memberPage.getByRole('button', { name: accounts.member.name }).click()
    await expect(memberPage.getByRole('menuitem', { name: 'Members' })).toBeVisible()
  })
})
