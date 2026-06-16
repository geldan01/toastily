import { expect, gotoReady, test } from '../fixtures/roles'

/**
 * Members-area announcements UI (issue #17, PRD §7.1). Confirms the officer
 * compose flow works end-to-end in the browser — the compose form is hidden
 * behind a button, the Post button enables once a body is typed (the binding
 * the integration layer can't see), and a posted announcement shows up in the
 * list for the author. The API contract is pinned in
 * tests/integration/messages-api.spec.ts.
 */
test.describe('members announcements', () => {
  test('an admin opens the form, posts an announcement, and sees it listed', async ({ adminPage, apiAs }) => {
    await gotoReady(adminPage, '/members')

    // Compose form is hidden until the button is clicked.
    const textarea = adminPage.getByPlaceholder('Share an announcement with members')
    await expect(textarea).toBeHidden()

    await adminPage.getByRole('button', { name: 'Add message to members' }).click()
    await expect(textarea).toBeVisible()

    // Post button starts disabled and enables once a body is typed.
    const postButton = adminPage.getByRole('button', { name: 'Post', exact: true })
    await expect(postButton).toBeDisabled()

    const body = `E2E announcement ${Date.now()}`
    await textarea.fill(body)
    await expect(postButton).toBeEnabled()

    const posted = adminPage.waitForResponse(
      r => r.url().includes('/api/messages') && r.request().method() === 'POST',
    )
    await postButton.click()
    expect((await posted).status()).toBe(200)

    // The announcement appears in the list and the form closes.
    await expect(adminPage.getByText(body)).toBeVisible()
    await expect(textarea).toBeHidden()

    // Clean up via the API.
    const list = await (await apiAs('admin')).get('/api/messages')
    const created = (await list.json()).messages.find((m: { body: string }) => m.body === body)
    if (created) await (await apiAs('admin')).delete(`/api/messages/${created.id}`)
  })

  test('a plain member sees no compose button', async ({ memberPage }) => {
    await gotoReady(memberPage, '/members')
    await expect(memberPage.getByRole('button', { name: 'Add message to members' })).toHaveCount(0)
  })
})
