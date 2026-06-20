import { inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Digital written evaluations (issue #60, peer feedback). Pins the eligibility
 * gate (must be checked in — member or guest), the member-or-guest submit paths,
 * editability (one per evaluator/speech), the self-evaluation block, ratings
 * validation, and the privacy of received evaluations in the participation
 * timeline (speaker/admin only).
 *
 * Self-contained: own meeting on a unique future date, the officer account as the
 * speaker and the member account as a peer evaluator; cleaned up afterward.
 */
test.describe('written evaluations API', () => {
  test.describe.configure({ mode: 'serial' })

  const meetingDate = (() => {
    const d = new Date(Date.UTC(2099, 0, 1))
    d.setUTCDate(d.getUTCDate() + (Date.now() % 20000))
    return d.toISOString().slice(0, 10)
  })()

  let meetingId = ''
  let speechId = ''
  let memberId = ''
  let officerId = ''

  test.beforeAll(async () => {
    const db = testDb()
    const users = await db.select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(inArray(schema.users.email, [TEST_ACCOUNTS.member.email, TEST_ACCOUNTS.officer.email]))
    const byEmail = new Map(users.map(u => [u.email, u.id]))
    memberId = byEmail.get(TEST_ACCOUNTS.member.email)!
    officerId = byEmail.get(TEST_ACCOUNTS.officer.email)!
  })

  test.afterAll(async ({ apiAs }) => {
    if (meetingId) {
      const admin = await apiAs('admin')
      await admin.delete(`/api/admin/meetings/${meetingId}`)
    }
  })

  test('admin creates a meeting with the officer as speaker of slot 1', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const created = await admin.post('/api/admin/meetings', { data: { date: meetingDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    meetingId = (await created.json()).meeting.id

    const assign = await admin.post('/api/meetings/speech', {
      data: { meetingId, slot: 1, field: 'speaker', userId: officerId },
    })
    expect(assign.ok(), await assign.text()).toBeTruthy()

    // The evaluations endpoint exposes the evaluable speech with its id.
    const list = await (await admin.get(`/api/meetings/${meetingDate}/evaluations`)).json()
    expect(list.speeches.length).toBe(1)
    speechId = list.speeches[0].id
    expect(list.speeches[0].speakerName).toBeTruthy()
  })

  test('a member who is not checked in cannot evaluate (403)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/meetings/evaluation', {
      data: { speechId, structureRating: 4, vocalVarietyRating: 4, gesturesRating: 4 },
    })
    expect(res.status()).toBe(403)
  })

  test('a checked-in member submits an evaluation', async ({ apiAs }) => {
    const member = await apiAs('member')
    const checkin = await member.post('/api/meetings/attendance', { data: { meetingId } })
    expect(checkin.ok(), await checkin.text()).toBeTruthy()

    const res = await member.post('/api/meetings/evaluation', {
      data: {
        speechId,
        liked: 'Clear structure',
        recommend: 'Slow down',
        structureRating: 4,
        vocalVarietyRating: 3,
        gesturesRating: 5,
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const { evaluation } = await res.json()
    expect(evaluation.evaluatorUserId).toBe(memberId)
    expect(evaluation.structureRating).toBe(4)

    // selfEligible + pre-filled "mine" now reflect the submission.
    const list = await (await member.get(`/api/meetings/${meetingDate}/evaluations`)).json()
    expect(list.selfEligible).toBe(true)
    expect(list.mine[speechId].gesturesRating).toBe(5)
  })

  test('re-submitting updates the existing evaluation (one per evaluator/speech)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const first = await member.post('/api/meetings/evaluation', {
      data: { speechId, structureRating: 2, vocalVarietyRating: 2, gesturesRating: 2 },
    })
    const firstId = (await first.json()).evaluation.id
    const second = await member.post('/api/meetings/evaluation', {
      data: { speechId, structureRating: 1, vocalVarietyRating: 1, gesturesRating: 1 },
    })
    const second2 = await second.json()
    expect(second2.evaluation.id).toBe(firstId)
    expect(second2.evaluation.structureRating).toBe(1)
  })

  test('ratings must be whole numbers 1–5 (400)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/meetings/evaluation', {
      data: { speechId, structureRating: 6, vocalVarietyRating: 3, gesturesRating: 3 },
    })
    expect(res.status()).toBe(400)
  })

  test('the speaker cannot evaluate their own speech (409)', async ({ apiAs }) => {
    const officer = await apiAs('officer')
    const res = await officer.post('/api/meetings/evaluation', {
      data: { speechId, structureRating: 5, vocalVarietyRating: 5, gesturesRating: 5 },
    })
    expect(res.status()).toBe(409)
  })

  test('a checked-in guest evaluates by name; an unknown name is rejected (403)', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    const checkin = await guest.post('/api/meetings/checkin', { data: { meetingId, name: 'Eval Guest' } })
    expect(checkin.ok(), await checkin.text()).toBeTruthy()

    const ok = await guest.post('/api/meetings/evaluation', {
      data: { speechId, guestName: 'Eval Guest', structureRating: 5, vocalVarietyRating: 4, gesturesRating: 4 },
    })
    expect(ok.ok(), await ok.text()).toBeTruthy()
    expect((await ok.json()).evaluation.evaluatorGuestName).toBe('Eval Guest')

    const notCheckedIn = await guest.post('/api/meetings/evaluation', {
      data: { speechId, guestName: 'Random Stranger', structureRating: 5, vocalVarietyRating: 4, gesturesRating: 4 },
    })
    expect(notCheckedIn.status()).toBe(403)
  })

  test('received evaluations are private: speaker and admin see them, peers do not', async ({ apiAs }) => {
    // The speaker (officer) sees the feedback received (member + guest = 2).
    const officer = await apiAs('officer')
    const own = await (await officer.get(`/api/participation/${officerId}`)).json()
    expect(own.evaluationsReceived.length).toBeGreaterThanOrEqual(2)
    expect(own.evaluationsReceived.some((e: { evaluatorName: string }) => e.evaluatorName === 'Eval Guest')).toBeTruthy()

    // A peer member viewing the officer's timeline gets none.
    const member = await apiAs('member')
    const asPeer = await (await member.get(`/api/participation/${officerId}`)).json()
    expect(asPeer.evaluationsReceived).toEqual([])

    // An admin may see them.
    const admin = await apiAs('admin')
    const asAdmin = await (await admin.get(`/api/participation/${officerId}`)).json()
    expect(asAdmin.evaluationsReceived.length).toBeGreaterThanOrEqual(2)
  })

  test('a member can retract their own evaluation', async ({ apiAs }) => {
    const member = await apiAs('member')
    const list = await (await member.get(`/api/meetings/${meetingDate}/evaluations`)).json()
    const mineId = list.mine[speechId].id
    const res = await member.delete('/api/meetings/evaluation', { data: { id: mineId } })
    expect(res.ok(), await res.text()).toBeTruthy()

    const after = await (await member.get(`/api/meetings/${meetingDate}/evaluations`)).json()
    expect(after.mine[speechId]).toBeUndefined()
  })
})
