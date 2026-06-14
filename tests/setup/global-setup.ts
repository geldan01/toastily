import { mkdir } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { request, type FullConfig } from '@playwright/test'
import { BASE_URL, STORAGE_STATE_DIR } from './config'
import { ALL_ACCOUNTS, AUTHED_KEYS, TEST_ACCOUNTS } from './accounts'
import { closeTestDb, schema, testDb } from './test-db'

/**
 * Runs once before the Playwright suite (after the webServer is up). It:
 *   1. registers each test account through the real /api/auth/register endpoint
 *      (so passwords are hashed exactly as production does), tolerating 409s on
 *      reseeded runs;
 *   2. promotes each account in the DB to its intended status + marks the email
 *      verified, independent of the "first user becomes admin" bootstrap order;
 *   3. logs each authed role in and saves its sealed-session cookie to
 *      tests/.auth/<role>.json for the per-role fixtures to reuse.
 */
async function globalSetup(_config: FullConfig) {
  await mkdir(STORAGE_STATE_DIR, { recursive: true })
  const api = await request.newContext({ baseURL: BASE_URL })
  const db = testDb()

  for (const acct of ALL_ACCOUNTS) {
    const res = await api.post('/api/auth/register', {
      data: { name: acct.name, email: acct.email, password: acct.password, locale: 'en' },
    })
    if (!res.ok() && res.status() !== 409) {
      throw new Error(`Failed to seed ${acct.email}: ${res.status()} ${await res.text()}`)
    }
    // Force the intended status + verified email regardless of bootstrap order.
    await db.update(schema.users)
      .set({ status: acct.status, emailVerified: true })
      .where(eq(schema.users.email, acct.email))
  }

  for (const key of AUTHED_KEYS) {
    const acct = TEST_ACCOUNTS[key]
    const ctx = await request.newContext({ baseURL: BASE_URL })
    const res = await ctx.post('/api/auth/login', {
      data: { email: acct.email, password: acct.password },
    })
    if (!res.ok()) {
      throw new Error(`Login failed for ${acct.email}: ${res.status()} ${await res.text()}`)
    }
    await ctx.storageState({ path: `${STORAGE_STATE_DIR}/${key}.json` })
    await ctx.dispose()
  }

  await api.dispose()
  await closeTestDb()
}

export default globalSetup
