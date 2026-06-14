import { eq } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { latestEmailToken } from '../setup/email'
import { schema, testDb } from '../setup/test-db'

/**
 * Membership request → approval (PRD §4.3). A self-contained guest is created
 * per run (so it never mutates the shared fixture accounts), confirms their
 * email, requests membership, an officer approves, and the guest is promoted to
 * member with a role-history row. Authority is enforced server-side: a plain
 * member may not approve.
 */
test.describe('membership API', () => {
  test.describe.configure({ mode: 'serial' })

  const email = `applicant+${Date.now()}@toastily.test`
  const password = 'applicant-pass-123'

  test('a verified guest can request membership', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    await guest.post('/api/auth/register', {
      data: { name: 'Applicant', email, password, locale: 'en' },
    })
    const token = await latestEmailToken(email, 'verify')
    await guest.post('/api/auth/verify', { data: { token } })

    const req = await guest.post('/api/membership/request', { data: { message: 'Please let me in' } })
    expect(req.ok()).toBeTruthy()
    expect(await req.json()).toMatchObject({ status: 'pending' })
  })

  test('a plain member cannot approve requests (403)', async ({ apiAs }) => {
    const db = testDb()
    const [user] = await db.select({ id: schema.users.id })
      .from(schema.users).where(eq(schema.users.email, email)).limit(1)
    const [request] = await db.select({ id: schema.membershipRequests.id })
      .from(schema.membershipRequests).where(eq(schema.membershipRequests.userId, user!.id)).limit(1)

    const member = await apiAs('member')
    const res = await member.post(`/api/membership/requests/${request!.id}/approve`)
    expect(res.status()).toBe(403)
  })

  test('an officer approval promotes the guest to member', async ({ apiAs }) => {
    const db = testDb()
    const [user] = await db.select({ id: schema.users.id, status: schema.users.status })
      .from(schema.users).where(eq(schema.users.email, email)).limit(1)
    expect(user!.status).toBe('guest')

    const [request] = await db.select({ id: schema.membershipRequests.id })
      .from(schema.membershipRequests).where(eq(schema.membershipRequests.userId, user!.id)).limit(1)

    const officer = await apiAs('officer')
    const res = await officer.post(`/api/membership/requests/${request!.id}/approve`)
    expect(res.ok()).toBeTruthy()

    const [after] = await db.select({ status: schema.users.status })
      .from(schema.users).where(eq(schema.users.id, user!.id)).limit(1)
    expect(after!.status).toBe('member')

    const [history] = await db.select({ toStatus: schema.roleHistory.toStatus })
      .from(schema.roleHistory).where(eq(schema.roleHistory.userId, user!.id)).limit(1)
    expect(history!.toStatus).toBe('member')
  })
})
