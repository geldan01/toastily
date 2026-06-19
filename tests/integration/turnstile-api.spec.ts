import { expect, test } from '../fixtures/roles'

/**
 * CAPTCHA bot-protection contract (issue #26). Registration and password reset
 * are gated by Cloudflare Turnstile (`requireTurnstile`). Turnstile is left
 * unconfigured in the test env (no TURNSTILE_SECRET_KEY) so the gate takes its
 * graceful-bypass branch — exactly like local dev and the email stub. That lets
 * us pin the degradation behaviour (the app still works end-to-end without a
 * CAPTCHA provider) without calling Cloudflare's siteverify from CI. The
 * configured path is exercised manually with Cloudflare's always-pass test keys.
 */
test.describe('Turnstile-gated endpoints (unconfigured → bypass)', () => {
  test('register succeeds without a CAPTCHA token when Turnstile is unconfigured', async ({ apiAs }) => {
    const api = await apiAs('guest')
    const res = await api.post('/api/auth/register', {
      data: {
        name: 'Captcha Bypass',
        email: `captcha+${Date.now()}@toastily.test`,
        password: 'fresh-password-123',
        locale: 'en',
        consent: true,
        // No turnstileToken — the gate must not block when unconfigured.
      },
    })
    expect(res.ok()).toBeTruthy()
    expect(await res.json()).toMatchObject({ status: 'guest', verified: false })
  })

  test('password reset request succeeds without a CAPTCHA token when unconfigured', async ({ apiAs }) => {
    const api = await apiAs('guest')
    const res = await api.post('/api/auth/request-reset', {
      data: { email: `nobody+${Date.now()}@toastily.test` },
    })
    // Always ok (never leaks which emails exist) — and the CAPTCHA gate is a no-op.
    expect(res.ok()).toBeTruthy()
    expect(await res.json()).toMatchObject({ ok: true })
  })
})
