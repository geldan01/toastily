import { asc, eq } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Member personal dashboard (issue #57), read-side. Pins the member-only auth
 * boundary, the response shape, and that a role + speech recorded on an upcoming
 * scheduled meeting surfaces in the member's own `upcoming` commitments.
 */
test.describe('dashboard API', () => {
  test.describe.configure({ mode: 'serial' })

  // A future date keeps the meeting "upcoming" (date >= today, scheduled).
  const meetingDate = (() => {
    const d = new Date(Date.UTC(2098, 0, 1))
    d.setUTCDate(d.getUTCDate() + (Date.now() % 20000))
    return d.toISOString().slice(0, 10)
  })()

  let meetingId = ''
  let memberId = ''

  test.beforeAll(async () => {
    const db = testDb()
    const [member] = await db.select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, TEST_ACCOUNTS.member.email))
      .limit(1)
    memberId = member!.id
  })

  test('a guest cannot read the dashboard (401)', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    const res = await guest.get('/api/me/dashboard')
    expect(res.status()).toBe(401)
  })

  test('a member can read the dashboard and gets the expected shape', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.get('/api/me/dashboard')
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.memberId).toBe(memberId)
    expect(Array.isArray(body.upcoming)).toBeTruthy()
    expect(body.recent).toBeTruthy()
    expect(Array.isArray(body.recent.attended)).toBeTruthy()
  })

  test('a role and a speech on an upcoming meeting surface in the member commitments', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const created = await admin.post('/api/admin/meetings', { data: { date: meetingDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    meetingId = (await created.json()).meeting.id

    const db = testDb()
    const [role] = await db.select({ id: schema.meetingRoles.id })
      .from(schema.meetingRoles)
      .where(eq(schema.meetingRoles.active, true))
      .orderBy(asc(schema.meetingRoles.sortOrder))
      .limit(1)
    const signup = await admin.post('/api/meetings/signup', {
      data: { meetingId, roleId: role!.id, userId: memberId },
    })
    expect(signup.ok(), await signup.text()).toBeTruthy()

    const speaker = await admin.post('/api/meetings/speech', {
      data: { meetingId, slot: 1, field: 'speaker', userId: memberId },
    })
    expect(speaker.ok(), await speaker.text()).toBeTruthy()
    const evaluator = await admin.post('/api/meetings/speech', {
      data: { meetingId, slot: 2, field: 'evaluator', userId: memberId },
    })
    expect(evaluator.ok(), await evaluator.text()).toBeTruthy()

    const member = await apiAs('member')
    const res = await member.get('/api/me/dashboard')
    const body = await res.json()
    const entry = body.upcoming.find((m: { date: string }) => m.date === meetingDate)
    expect(entry, 'the upcoming meeting with commitments is present').toBeTruthy()
    expect(entry.roles.length).toBeGreaterThanOrEqual(1)
    expect(entry.speaking.some((s: { slot: number }) => s.slot === 1)).toBeTruthy()
    expect(entry.evaluating.some((e: { slot: number }) => e.slot === 2)).toBeTruthy()
  })
})
