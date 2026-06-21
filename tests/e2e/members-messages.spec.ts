import { expect, gotoReady, test } from '../fixtures/roles'

/**
 * Members-area announcements UI (issues #17/#63, PRD §7.1). Confirms the
 * communication-manager compose flow works end-to-end in the browser — the
 * compose form is hidden behind a button, the Post button enables once all four
 * bilingual fields are filled (the binding the integration layer can't see), and
 * a posted announcement shows up in the list for the author. The API contract is
 * pinned in tests/integration/messages-api.spec.ts.
 */
test.describe('members announcements', () => {
  test('an admin opens the form, posts a bilingual announcement, and sees it listed', async ({ adminPage, apiAs }) => {
    await gotoReady(adminPage, '/members')

    // Compose form is hidden until the button is clicked.
    const bodies = adminPage.getByPlaceholder('Share an announcement with members')
    await expect(bodies.first()).toBeHidden()

    await adminPage.getByRole('button', { name: 'Add message to members' }).click()

    // Two title inputs and two body textareas — EN first, FR second.
    const titles = adminPage.getByPlaceholder('Title')
    await expect(titles.first()).toBeVisible()

    // Post button starts disabled and enables once all four fields are filled.
    const postButton = adminPage.getByRole('button', { name: 'Post', exact: true })
    await expect(postButton).toBeDisabled()

    const stamp = Date.now()
    const titleEn = `E2E announcement ${stamp}`
    await titles.nth(0).fill(titleEn)
    await titles.nth(1).fill(`Annonce E2E ${stamp}`)
    await bodies.nth(0).fill('English body')
    await bodies.nth(1).fill('Corps français')
    await expect(postButton).toBeEnabled()

    const posted = adminPage.waitForResponse(
      r => r.url().includes('/api/messages') && r.request().method() === 'POST',
    )
    await postButton.click()
    expect((await posted).status()).toBe(200)

    // The English title appears in the list and the form closes.
    await expect(adminPage.getByText(titleEn)).toBeVisible()
    await expect(titles.first()).toBeHidden()

    // Clean up via the API.
    const list = await (await apiAs('admin')).get('/api/messages')
    const created = (await list.json()).messages.find((m: { titleEn: string }) => m.titleEn === titleEn)
    if (created) await (await apiAs('admin')).delete(`/api/messages/${created.id}`)
  })

  test('a plain member sees no compose button', async ({ memberPage }) => {
    await gotoReady(memberPage, '/members')
    await expect(memberPage.getByRole('button', { name: 'Add message to members' })).toHaveCount(0)
  })
})
