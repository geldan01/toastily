import { expect, gotoReady, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'

/**
 * Mentorship pairing UI (issue #62). Confirms a people-manager (admin) can set a
 * member's mentor from the member's participation page via the picker→POST→refresh
 * flow the integration layer can't see, and that the pairing renders as
 * "Mentored by {mentor}". The API contract + read paths are pinned in
 * tests/integration/mentorship-api.spec.ts.
 */
test.describe('mentorship pairing', () => {
  async function memberId(api: import('@playwright/test').APIRequestContext, email: string) {
    const { members } = await (await api.get('/api/admin/members')).json()
    return (members as { id: string, email: string }[]).find(m => m.email === email)!.id
  }

  test('an admin sets a member mentor and it shows on the page', async ({ adminPage, apiAs }) => {
    const admin = await apiAs('admin')
    const menteeId = await memberId(admin, TEST_ACCOUNTS.member.email)

    await gotoReady(adminPage, `/participation/${menteeId}`)
    await expect(adminPage.getByRole('heading', { name: TEST_ACCOUNTS.member.name })).toBeVisible()

    // Pick a mentor (the seeded officer) and save.
    const picker = adminPage.locator('select').first()
    await picker.selectOption({ label: TEST_ACCOUNTS.officer.name })
    const saved = adminPage.waitForResponse(
      r => r.url().includes('/api/mentorships') && r.request().method() === 'POST',
    )
    await adminPage.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await saved).status()).toBe(200)

    // The pairing renders as a link to the mentor's page (not just a picker option).
    await expect(adminPage.getByRole('link', { name: TEST_ACCOUNTS.officer.name })).toBeVisible()

    // Clean up: end every current pairing for this mentee via the API.
    const view = await (await admin.get(`/api/participation/${menteeId}`)).json()
    if (view.mentor) await admin.delete(`/api/mentorships/${view.mentor.mentorshipId}`)
  })
})
