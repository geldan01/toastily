import { eq, inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Voting lifecycle (PRD §8) end to end on a Table Topics ballot (which starts
 * empty, so no speech setup is needed): a contextual meeting manager prepares →
 * adds candidates → opens → the public casts one vote per device → manager
 * closes → tallies are revealed to the manager only. Also pins the guards:
 * non-managers can't open, voting is rejected once closed, and tallies stay
 * hidden from non-managers.
 */
test.describe('voting API', () => {
  test.describe.configure({ mode: 'serial' })

  const CATEGORY = 'best_table_topics_speaker'
  const meetingDate = (() => {
    const d = new Date(Date.UTC(2098, 0, 1))
    d.setUTCDate(d.getUTCDate() + (Date.now() % 20000))
    return d.toISOString().slice(0, 10)
  })()

  let meetingId = ''
  let sessionId = ''
  let candAId = ''
  let candBId = ''
  let managerId = ''
  let memberId = ''

  test.beforeAll(async () => {
    const db = testDb()
    const users = await db.select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(inArray(schema.users.email, [TEST_ACCOUNTS.manager.email, TEST_ACCOUNTS.member.email]))
    const byEmail = new Map(users.map(u => [u.email, u.id]))
    managerId = byEmail.get(TEST_ACCOUNTS.manager.email)!
    memberId = byEmail.get(TEST_ACCOUNTS.member.email)!
  })

  test('admin sets up a meeting with the manager as Toastmaster', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const created = await admin.post('/api/admin/meetings', { data: { date: meetingDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    meetingId = (await created.json()).meeting.id

    const db = testDb()
    const [authority] = await db.select({ id: schema.meetingRoles.id })
      .from(schema.meetingRoles)
      .where(eq(schema.meetingRoles.grantsMeetingAuthority, true))
      .limit(1)
    const assign = await admin.post('/api/meetings/signup', {
      data: { meetingId, roleId: authority!.id, userId: managerId },
    })
    expect(assign.ok()).toBeTruthy()
  })

  test('a non-manager cannot open a ballot (403)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/meetings/voting/open', {
      data: { meetingId, categories: [CATEGORY] },
    })
    expect(res.status()).toBe(403)
  })

  test('the contextual manager opens the ballot and adds candidates', async ({ apiAs }) => {
    const manager = await apiAs('manager')
    const opened = await manager.post('/api/meetings/voting/open', {
      data: { meetingId, categories: [CATEGORY] },
    })
    expect(opened.ok(), await opened.text()).toBeTruthy()
    sessionId = (await opened.json()).sessions[0].id

    const a = await manager.post('/api/meetings/voting/candidate', {
      data: { sessionId, guestName: 'Topics Speaker A' },
    })
    candAId = (await a.json()).candidate.id
    const b = await manager.post('/api/meetings/voting/candidate', {
      data: { sessionId, userId: memberId },
    })
    candBId = (await b.json()).candidate.id
    expect(candAId).toBeTruthy()
    expect(candBId).toBeTruthy()
  })

  test('the public votes once per device (A:2, B:1)', async ({ apiAs }) => {
    for (const candidateId of [candAId, candAId, candBId]) {
      const device = await apiAs('guest') // a fresh context == a fresh device
      const res = await device.post('/api/meetings/voting/vote', { data: { sessionId, candidateId } })
      expect(res.ok(), await res.text()).toBeTruthy()
    }
  })

  test('one device gets a single ballot even after re-voting', async ({ apiAs }) => {
    const device = await apiAs('guest')
    await device.post('/api/meetings/voting/vote', { data: { sessionId, candidateId: candAId } })
    // Re-vote to B — replaces, not adds (unique session+token).
    const change = await device.post('/api/meetings/voting/vote', { data: { sessionId, candidateId: candBId } })
    expect(change.ok()).toBeTruthy()
    // Net tally is now A:2, B:2 (this device's single ballot moved to B).
  })

  test('closing reveals the tally to the manager only', async ({ apiAs }) => {
    const manager = await apiAs('manager')
    const closed = await manager.post('/api/meetings/voting/close', { data: { sessionIds: [sessionId] } })
    expect(closed.ok()).toBeTruthy()

    const view = await (await apiAs('manager')).get(`/api/meetings/voting/${meetingDate}`)
    const body = await view.json()
    const cat = body.categories.find((c: { category: string }) => c.category === CATEGORY)
    expect(cat.status).toBe('closed')
    expect(cat.results).not.toBeNull()
    const a = cat.results.find((r: { name: string }) => r.name === 'Topics Speaker A')
    expect(a.votes).toBe(2)

    // A non-manager never sees the tally, even once closed.
    const publicView = await (await apiAs('guest')).get(`/api/meetings/voting/${meetingDate}`)
    const publicCat = (await publicView.json()).categories.find((c: { category: string }) => c.category === CATEGORY)
    expect(publicCat.results).toBeNull()
  })

  test('voting is rejected once the ballot is closed (409)', async ({ apiAs }) => {
    const device = await apiAs('guest')
    const res = await device.post('/api/meetings/voting/vote', { data: { sessionId, candidateId: candAId } })
    expect(res.status()).toBe(409)
  })
})
