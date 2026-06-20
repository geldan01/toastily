import { expect, gotoReady, test } from '../fixtures/roles'

/**
 * Member personal dashboard (issue #57). Confirms the page renders for a member
 * in the browser — the greeting, the upcoming-commitments and recent-activity
 * sections — and that a guest is bounced by the member middleware. The data
 * contract is pinned in tests/integration/dashboard-api.spec.ts.
 */
test.describe('member dashboard', () => {
  test('a member sees their dashboard sections', async ({ memberPage }) => {
    await gotoReady(memberPage, '/dashboard')

    await expect(memberPage.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
    await expect(memberPage.getByRole('heading', { name: 'Upcoming commitments' })).toBeVisible()
    await expect(memberPage.getByRole('heading', { name: 'Recent activity' })).toBeVisible()
  })

  test('a guest is redirected away from the dashboard', async ({ guestPage }) => {
    await gotoReady(guestPage, '/dashboard')
    await expect(guestPage).not.toHaveURL(/\/dashboard$/)
  })
})
