import { expect, gotoReady, test } from '../fixtures/roles'

/**
 * Pathways progress tracker UI (issue #58, PRD §7.1 members area). Confirms the
 * page renders for a member with the prominent "does not replace Base Camp"
 * caveat, and that enrolling in a path through the picker works end-to-end (the
 * select→POST→list refresh the integration layer can't see). The API contract is
 * pinned in tests/integration/pathways-api.spec.ts.
 */
test.describe('pathways tracker', () => {
  test('a member reads the Base Camp caveat and enrolls in a path', async ({ memberPage, apiAs }) => {
    await gotoReady(memberPage, '/pathways')

    await expect(memberPage.getByRole('heading', { name: 'My Pathways' })).toBeVisible()
    // The Base Camp caveat must be shown prominently (issue #58).
    await expect(memberPage.getByText('This does not replace Base Camp')).toBeVisible()

    // Enroll in the first offered path via the picker.
    const picker = memberPage.locator('#add-path')
    await expect(picker).toBeVisible()
    const firstValue = await picker.locator('option').nth(1).getAttribute('value')
    await picker.selectOption(firstValue!)

    const enrolled = memberPage.waitForResponse(
      r => r.url().includes('/api/pathways/enrollments') && r.request().method() === 'POST',
    )
    await memberPage.getByRole('button', { name: 'Start tracking' }).click()
    expect((await enrolled).status()).toBe(200)

    // The enrolled path shows up as the current one, with an Add project action.
    await expect(memberPage.getByText('Current', { exact: true })).toBeVisible()
    await expect(memberPage.getByRole('button', { name: 'Add a project' })).toBeVisible()

    // Clean up the member's enrollments via the API.
    const tracker = await (await apiAs('member')).get('/api/pathways')
    for (const e of (await tracker.json()).enrollments) {
      await (await apiAs('member')).delete(`/api/pathways/enrollments/${e.id}`)
    }
  })
})
