import { and, desc, eq } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { latestEmailToken } from '../setup/email'
import { schema, testDb } from '../setup/test-db'

/**
 * Membership-request notifications, pending-count badge, and member revocation
 * (issue #50). A self-contained applicant is created per run (never touches the
 * shared fixture accounts): they request membership (which must enqueue a
 * `membership_request_received` send), an officer reads the pending count, then
 * an admin revokes them — recording an audit row in `role_history`.
 */
test.describe('membership notifications + revocation API', () => {
  test.describe.configure({ mode: 'serial' })

  const email = `notify-applicant+${Date.now()}@toastily.test`
  const password = 'notify-applicant-pass-123'

  async function applicantId() {
    const [u] = await testDb().select({ id: schema.users.id, status: schema.users.status })
      .from(schema.users).where(eq(schema.users.email, email)).limit(1)
    return u
  }

  test('a new request enqueues a membership_request_received send', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    await guest.post('/api/auth/register', {
      data: { name: 'Notify Applicant', email, password, locale: 'en', consent: true },
    })
    const token = await latestEmailToken(email, 'verify')
    await guest.post('/api/auth/verify', { data: { token } })

    const req = await guest.post('/api/membership/request', { data: { message: 'Keen to join' } })
    expect(req.ok()).toBeTruthy()

    // A send was logged: triggered, the membership template, ≥1 recipient (the
    // site admin is always a recipient). Email isn't configured in tests → stubbed.
    const [log] = await testDb().select()
      .from(schema.emailSendLog)
      .where(and(
        eq(schema.emailSendLog.templateKey, 'membership_request_received'),
        eq(schema.emailSendLog.trigger, 'triggered'),
      ))
      .orderBy(desc(schema.emailSendLog.sentAt))
      .limit(1)

    expect(log).toBeTruthy()
    expect(log!.recipientCount).toBeGreaterThanOrEqual(1)
    expect(log!.status).toBe('stubbed')
  })

  test('officers see the pending count; members and guests do not', async ({ apiAs }) => {
    const officer = await apiAs('officer')
    const res = await officer.get('/api/membership/requests/count')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.pending).toBeGreaterThanOrEqual(1)

    const member = await apiAs('member')
    expect((await member.get('/api/membership/requests/count')).status()).toBe(403)

    const guest = await apiAs('guest')
    expect((await guest.get('/api/membership/requests/count')).status()).toBe(401)
  })

  test('a plain member cannot revoke another member (403)', async ({ apiAs }) => {
    // Promote the applicant to member first (so there is a member to revoke).
    const officer = await apiAs('officer')
    const [request] = await testDb().select({ id: schema.membershipRequests.id })
      .from(schema.membershipRequests).where(eq(schema.membershipRequests.userId, (await applicantId())!.id)).limit(1)
    await officer.post(`/api/membership/requests/${request!.id}/approve`)
    expect((await applicantId())!.status).toBe('member')

    const member = await apiAs('member')
    const res = await member.post(`/api/members/${(await applicantId())!.id}/revoke`)
    expect(res.status()).toBe(403)
  })

  test('an admin revokes a member → guest, with a role_history audit row', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const id = (await applicantId())!.id

    const res = await admin.post(`/api/members/${id}/revoke`)
    expect(res.ok()).toBeTruthy()

    expect((await applicantId())!.status).toBe('guest')

    const [history] = await testDb().select({ toStatus: schema.roleHistory.toStatus, note: schema.roleHistory.note })
      .from(schema.roleHistory)
      .where(and(eq(schema.roleHistory.userId, id), eq(schema.roleHistory.toStatus, 'guest')))
      .orderBy(desc(schema.roleHistory.createdAt))
      .limit(1)
    expect(history).toBeTruthy()
    expect(history!.note).toBe('Membership revoked')
  })

  test('revoking a non-member (already guest) is rejected (400)', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const res = await admin.post(`/api/members/${(await applicantId())!.id}/revoke`)
    expect(res.status()).toBe(400)
  })

  test('an admin cannot revoke their own membership (400)', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const [me] = await testDb().select({ id: schema.users.id })
      .from(schema.users).where(eq(schema.users.email, 'admin@toastily.test')).limit(1)
    const res = await admin.post(`/api/members/${me!.id}/revoke`)
    expect(res.status()).toBe(400)
  })
})
