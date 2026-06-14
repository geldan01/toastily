import { expect, test } from '../fixtures/roles'
import { latestEmailToken } from '../setup/email'

/**
 * Account lifecycle (PRD §4): register → email-confirm → login. Email is
 * stubbed (no Resend key), so the test reads the verification token straight
 * from the DB — the contract-level stand-in for clicking the emailed link.
 */
test.describe('auth API', () => {
  // These steps build on each other (register → dup → verify) — run in order.
  test.describe.configure({ mode: 'serial' })

  // Unique per run so it's a brand-new guest (never the bootstrap admin).
  const email = `newuser+${Date.now()}@toastily.test`
  const password = 'fresh-password-123'

  test('register creates an unverified guest who cannot log in yet', async ({ apiAs }) => {
    const api = await apiAs('guest')
    const res = await api.post('/api/auth/register', {
      data: { name: 'New User', email, password, locale: 'en' },
    })
    expect(res.ok()).toBeTruthy()
    expect(await res.json()).toMatchObject({ status: 'guest', verified: false })

    // Login is refused until the email is verified (403).
    const login = await api.post('/api/auth/login', { data: { email, password } })
    expect(login.status()).toBe(403)
  })

  test('registering the same email twice is a 409', async ({ apiAs }) => {
    const api = await apiAs('guest')
    const res = await api.post('/api/auth/register', {
      data: { name: 'Dup', email, password, locale: 'en' },
    })
    expect(res.status()).toBe(409)
  })

  test('verifying the emailed token activates the account and logs in', async ({ apiAs }) => {
    const api = await apiAs('guest')
    const token = await latestEmailToken(email, 'verify')
    expect(token, 'a verify token should have been issued at registration').toBeTruthy()

    const verify = await api.post('/api/auth/verify', { data: { token } })
    expect(verify.ok()).toBeTruthy()

    // The verify response logs the user in on this context.
    const me = await api.get('/api/auth/me')
    expect(me.ok()).toBeTruthy()

    // A fresh context can now log in with the same credentials.
    const fresh = await apiAs('guest')
    const login = await fresh.post('/api/auth/login', { data: { email, password } })
    expect(login.ok()).toBeTruthy()
  })

  test('a used or bogus token is rejected', async ({ apiAs }) => {
    const api = await apiAs('guest')
    const res = await api.post('/api/auth/verify', { data: { token: 'not-a-real-token' } })
    expect(res.status()).toBe(400)
  })
})
