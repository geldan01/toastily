import { expect, gotoReady, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'

/**
 * Member testimonials end-to-end (issue #27). The full curated path through the
 * real UI: a member writes an English testimonial on /account and saves it, a
 * content curator (admin) features it on /admin/testimonials, and an anonymous
 * visitor then sees the quote in the home page's testimonials section. The API
 * contract is pinned in tests/integration/testimonials-api.spec.ts.
 *
 * Serial because the three browser steps share one authored testimonial; the
 * afterAll resets it via the API so the seed state is left clean.
 */
test.describe.serial('member testimonials', () => {
  // Unique so the quote is unambiguous on the shared, possibly-populated home page.
  const quote = `E2E testimonial quote ${Date.now()}`

  test.afterAll(async ({ apiAs }) => {
    await (await apiAs('member')).put('/api/me/testimonial', { data: { bodyEn: '', bodyFr: '' } })
  })

  test('a member writes and saves an English testimonial on /account', async ({ memberPage }) => {
    await gotoReady(memberPage, '/account')

    const textarea = memberPage.locator('#testimonialEn')
    await expect(textarea).toBeVisible()
    await textarea.fill(quote)

    const saveButton = memberPage.getByRole('button', { name: 'Save testimonial' })
    const saved = memberPage.waitForResponse(
      r => r.url().includes('/api/me/testimonial') && r.request().method() === 'PUT',
    )
    await saveButton.click()
    expect((await saved).status()).toBe(200)

    // The button flips to its transient "Saved" state.
    await expect(memberPage.getByRole('button', { name: 'Saved' })).toBeVisible()
  })

  test('an admin curator features the member testimonial for English', async ({ adminPage }) => {
    await gotoReady(adminPage, '/admin/testimonials')

    // The card for the member who just authored the quote.
    const card = adminPage.locator('div').filter({
      has: adminPage.getByText(TEST_ACCOUNTS.member.email, { exact: true }),
    }).filter({ hasText: quote }).first()
    await expect(card).toBeVisible()

    // The English "Feature" button lives in that card's English section.
    const featureButton = card.getByRole('button', { name: 'Feature', exact: true }).first()
    const patched = adminPage.waitForResponse(
      r => r.url().includes('/api/admin/testimonials/') && r.request().method() === 'PATCH',
    )
    await featureButton.click()
    expect((await patched).status()).toBe(200)

    // After refresh the row shows the "Featured" badge / "Unfeature" action.
    await expect(card.getByRole('button', { name: 'Unfeature', exact: true }).first()).toBeVisible()
  })

  test('an anonymous visitor sees the featured quote on the home page', async ({ guestPage }) => {
    await gotoReady(guestPage, '/')
    await expect(guestPage.getByText(quote)).toBeVisible()
    await expect(guestPage.getByText(TEST_ACCOUNTS.member.name).first()).toBeVisible()
  })
})
