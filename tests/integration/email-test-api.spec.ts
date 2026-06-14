import { expect, test } from '../fixtures/roles'

/**
 * The admin email-delivery diagnostic (issue #28). It must be admin-only, and
 * it returns Resend's actual result so a misconfigured/unverified sender can't
 * fail silently. In the test environment no Resend key is configured, so the
 * send resolves to the `stub` mode — proving the endpoint reports delivery
 * state truthfully rather than always claiming success.
 */
test.describe('admin email-test API', () => {
  test('reports the stub mode when no Resend key is configured', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).post('/api/admin/email-test')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, stubbed: true, mode: 'stub' })
    expect(body.sentTo).toContain('@')
  })

  test('is forbidden for a non-admin officer', async ({ apiAs }) => {
    const res = await (await apiAs('officer')).post('/api/admin/email-test')
    expect(res.status()).toBe(403)
  })

  test('requires authentication', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).post('/api/admin/email-test')
    expect(res.status()).toBe(401)
  })
})
