import { expect, gotoReady, test } from '../fixtures/roles'

/**
 * News authoring UI smoke test (issue #12). Confirms the content-gated authoring
 * pages load and — critically — that the client-only Editor.js component mounts
 * in the browser (the main SSR/dynamic-import risk). The API contract and the
 * both-locales publish rule are pinned in tests/integration/news-admin-api.spec.ts.
 */
test.describe('news authoring', () => {
  // Editor.js ships a heavy bundle that the dev server compiles on first hit.
  test('admin creates a draft and the Editor.js body editor mounts', async ({ adminPage, apiAs }) => {
    test.slow()

    await gotoReady(adminPage, '/admin/news')
    await adminPage.getByRole('button', { name: 'New article' }).click()

    // Lands on the editor; Editor.js renders its `.codex-editor` container.
    await expect(adminPage).toHaveURL(/\/admin\/news\/[0-9a-f-]+/)
    const id = adminPage.url().split('/').pop()!.split('?')[0]
    await expect(adminPage.locator('.codex-editor').first()).toBeVisible({ timeout: 15000 })

    // Fill the English title and save the draft (wait on the PATCH to land).
    await adminPage.locator('#titleEn').fill('Smoke-test article')
    const saved = adminPage.waitForResponse(r => r.url().includes(`/api/admin/news/${id}`) && r.request().method() === 'PATCH')
    await adminPage.getByRole('button', { name: 'Save changes' }).click()
    expect((await saved).status()).toBe(200)

    // Switching to French swaps the visible fields.
    await adminPage.getByRole('button', { name: 'Français' }).click()
    await expect(adminPage.locator('#titleFr')).toBeVisible()

    // Clean up via the API (reliable, avoids the confirm() dialog).
    await (await apiAs('admin')).delete(`/api/admin/news/${id}`)
  })

  test('a plain member cannot reach the authoring pages', async ({ memberPage }) => {
    await memberPage.goto('/admin/news')
    await expect(memberPage).toHaveURL(/\/account/)
  })
})
