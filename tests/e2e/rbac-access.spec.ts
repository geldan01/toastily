import { expect, test } from '../fixtures/roles'

/**
 * Route-level RBAC (PRD §3.1, client middleware in app/middleware/*). Each
 * middleware sends unauthenticated visitors to /login and under-privileged but
 * authenticated users to /account. Verified here per role via the storage-state
 * fixtures; the server-side enforcement is checked in the integration layer.
 */
test.describe('RBAC route access', () => {
  test('member: reaches /members, blocked from /executive and /admin', async ({ memberPage }) => {
    await memberPage.goto('/members')
    await expect(memberPage).toHaveURL(/\/members/)

    await memberPage.goto('/executive')
    await expect(memberPage).toHaveURL(/\/account/)

    await memberPage.goto('/admin/settings')
    await expect(memberPage).toHaveURL(/\/account/)
  })

  test('officer: reaches /executive, blocked from admin-only pages', async ({ officerPage }) => {
    await officerPage.goto('/executive')
    await expect(officerPage).toHaveURL(/\/executive/)

    await officerPage.goto('/admin/settings')
    await expect(officerPage).toHaveURL(/\/account/)
  })

  test('admin: reaches admin settings and the executive hub', async ({ adminPage }) => {
    await adminPage.goto('/admin/settings')
    await expect(adminPage).toHaveURL(/\/admin\/settings/)

    await adminPage.goto('/executive')
    await expect(adminPage).toHaveURL(/\/executive/)
  })
})
