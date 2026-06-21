import { asc, eq } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Participation tracking & history (PRD §11), read-side. Pins the member-only
 * auth boundary, the bad-id / unknown-member guards, and that a member's
 * roles / speeches / evaluations surface in both the per-person timeline and
 * the club-wide summary once an admin records them.
 */
test.describe('participation API', () => {
  test.describe.configure({ mode: 'serial' })

  const meetingDate = (() => {
    const d = new Date(Date.UTC(2099, 0, 1))
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

  test('a guest cannot read the participation summary (401)', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    const res = await guest.get('/api/participation')
    expect(res.status()).toBe(401)
  })

  test('a member can read the participation summary', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.get('/api/participation')
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.members)).toBeTruthy()
    expect(body.members.some((m: { id: string }) => m.id === memberId)).toBeTruthy()
  })

  test('an invalid id is rejected (400) and an unknown member is 404', async ({ apiAs }) => {
    const member = await apiAs('member')
    expect((await member.get('/api/participation/not-a-uuid')).status()).toBe(400)
    const unknown = '00000000-0000-4000-8000-000000000000'
    expect((await member.get(`/api/participation/${unknown}`)).status()).toBe(404)
  })

  test('admin records a role, a speech and an evaluation for the member', async ({ apiAs }) => {
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

    // Member is both speaker and evaluator on slot 1.
    const speaker = await admin.post('/api/meetings/speech', {
      data: { meetingId, slot: 1, field: 'speaker', userId: memberId },
    })
    expect(speaker.ok(), await speaker.text()).toBeTruthy()
    const evaluator = await admin.post('/api/meetings/speech', {
      data: { meetingId, slot: 1, field: 'evaluator', userId: memberId },
    })
    expect(evaluator.ok(), await evaluator.text()).toBeTruthy()
    const titled = await admin.patch('/api/meetings/speech', {
      data: { meetingId, slot: 1, title: 'My Icebreaker' },
    })
    expect(titled.ok(), await titled.text()).toBeTruthy()
  })

  test('the per-person timeline reflects the recorded participation', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.get(`/api/participation/${memberId}`)
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()

    expect(body.member.id).toBe(memberId)
    expect(body.roles.some((r: { date: string }) => r.date === meetingDate)).toBeTruthy()
    expect(body.speeches.some((s: { title: string }) => s.title === 'My Icebreaker')).toBeTruthy()
    expect(body.evaluations.some((e: { date: string }) => e.date === meetingDate)).toBeTruthy()

    // Achievements (issue #64) — the recorded role/speech/evaluation earn the
    // matching first-time badges, derived purely from the counts above.
    const milestoneKeys = body.milestones.map((m: { key: string }) => m.key)
    expect(milestoneKeys).toContain('first_role')
    expect(milestoneKeys).toContain('first_speech')
    expect(milestoneKeys).toContain('first_evaluation')
  })

  test('the aggregate summary counts the recorded participation', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.get('/api/participation')
    const body = await res.json()
    const row = body.members.find((m: { id: string }) => m.id === memberId)
    expect(row.roles).toBeGreaterThanOrEqual(1)
    expect(row.speeches).toBeGreaterThanOrEqual(1)
    expect(row.evaluations).toBeGreaterThanOrEqual(1)
  })

  test('a guest cannot read the badge catalog (401)', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    expect((await guest.get('/api/participation/badges')).status()).toBe(401)
  })

  test('the badge catalog lists the member as a holder of the first-time badges', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.get('/api/participation/badges')
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()

    // The full catalog is always returned (badges with no holders included).
    expect(Array.isArray(body.badges)).toBeTruthy()
    expect(body.badges.length).toBeGreaterThanOrEqual(15)

    const holders = (key: string) =>
      (body.badges.find((b: { key: string }) => b.key === key)?.holders ?? []) as { id: string }[]
    for (const key of ['first_role', 'first_speech', 'first_evaluation']) {
      expect(holders(key).some(h => h.id === memberId), key).toBeTruthy()
    }
  })
})
