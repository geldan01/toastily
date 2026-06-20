import { inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Pathways progress tracker (issue #58). Pins the member-only auth boundary, the
 * path catalog, enrollment lifecycle (enroll / duplicate 409 / set current /
 * complete / remove), self-reported project CRUD with level validation, and the
 * project↔speech tie that mirrors the existing `speeches.pathways_project`
 * placeholder — including the "only your own speech" ownership guard.
 *
 * Self-contained: its own meeting on a unique future date with the member as the
 * speaker of slot 1 and the officer as the speaker of slot 2; cleaned up after.
 */
test.describe('pathways tracker API', () => {
  test.describe.configure({ mode: 'serial' })

  const meetingDate = (() => {
    const d = new Date(Date.UTC(2098, 0, 1))
    d.setUTCDate(d.getUTCDate() + (Date.now() % 20000))
    return d.toISOString().slice(0, 10)
  })()

  let meetingId = ''
  let memberSpeechId = ''
  let officerSpeechId = ''
  let memberId = ''
  let officerId = ''
  let pathAId = ''
  let pathBId = ''
  let enrollmentId = ''
  let projectId = ''

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

  test('an unauthenticated request cannot read the tracker (401)', async ({ apiAs }) => {
    const guest = await apiAs('guest') // the guest fixture carries no session
    const res = await guest.get('/api/pathways')
    expect(res.status()).toBe(401)
  })

  test('a member sees the seeded path catalog and no enrollments yet', async ({ apiAs }) => {
    const member = await apiAs('member')
    const data = await (await member.get('/api/pathways')).json()
    expect(Array.isArray(data.paths)).toBeTruthy()
    expect(data.paths.length).toBeGreaterThanOrEqual(11)
    expect(data.enrollments).toEqual([])
    pathAId = data.paths[0].id
    pathBId = data.paths[1].id
  })

  test('admin creates a meeting with the member and officer as speakers', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const created = await admin.post('/api/admin/meetings', { data: { date: meetingDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    meetingId = (await created.json()).meeting.id

    const s1 = await admin.post('/api/meetings/speech', { data: { meetingId, slot: 1, field: 'speaker', userId: memberId } })
    expect(s1.ok(), await s1.text()).toBeTruthy()
    memberSpeechId = (await s1.json()).speech.id
    const s2 = await admin.post('/api/meetings/speech', { data: { meetingId, slot: 2, field: 'speaker', userId: officerId } })
    expect(s2.ok(), await s2.text()).toBeTruthy()
    officerSpeechId = (await s2.json()).speech.id
  })

  test('a member enrolls in a path (current by default)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/pathways/enrollments', { data: { pathId: pathAId } })
    expect(res.ok(), await res.text()).toBeTruthy()
    const { enrollment } = await res.json()
    enrollmentId = enrollment.id
    expect(enrollment.isCurrent).toBe(true)
  })

  test('enrolling in the same path again is rejected (409)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/pathways/enrollments', { data: { pathId: pathAId } })
    expect(res.status()).toBe(409)
  })

  test('enrolling in a second current path clears the first', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/pathways/enrollments', { data: { pathId: pathBId } })
    expect(res.ok(), await res.text()).toBeTruthy()

    const data = await (await member.get('/api/pathways')).json()
    const current = data.enrollments.filter((e: { isCurrent: boolean }) => e.isCurrent)
    expect(current.length).toBe(1)
    expect(current[0].pathId).toBe(pathBId)
  })

  test('an invalid project level is rejected (400)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/pathways/projects', {
      data: { enrollmentId, level: 9, title: 'Bad level' },
    })
    expect(res.status()).toBe(400)
  })

  test('a member adds a project and links their own speech (mirrors the placeholder)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/pathways/projects', {
      data: { enrollmentId, level: 1, title: 'Ice Breaker', speechId: memberSpeechId },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    projectId = (await res.json()).project.id

    // The linked speech's pathways_project placeholder now carries the title.
    const db = testDb()
    const [speech] = await db.select({ pathwaysProject: schema.speeches.pathwaysProject })
      .from(schema.speeches).where(inArray(schema.speeches.id, [memberSpeechId]))
    expect(speech.pathwaysProject).toBe('Ice Breaker')

    // And it surfaces back on the tracker with the speech link resolved.
    const data = await (await member.get('/api/pathways')).json()
    const enrollment = data.enrollments.find((e: { id: string }) => e.id === enrollmentId)
    expect(enrollment.projects[0].speechId).toBe(memberSpeechId)
  })

  test('a member cannot link a speech they did not deliver (403)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/pathways/projects', {
      data: { enrollmentId, level: 2, title: 'Not mine', speechId: officerSpeechId },
    })
    expect(res.status()).toBe(403)
  })

  test('deleting the project clears the mirrored placeholder', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.delete(`/api/pathways/projects/${projectId}`)
    expect(res.ok(), await res.text()).toBeTruthy()

    const db = testDb()
    const [speech] = await db.select({ pathwaysProject: schema.speeches.pathwaysProject })
      .from(schema.speeches).where(inArray(schema.speeches.id, [memberSpeechId]))
    expect(speech.pathwaysProject).toBeNull()
  })

  test('a member cannot touch an enrollment that is not theirs (404)', async ({ apiAs }) => {
    const officer = await apiAs('officer')
    const res = await officer.patch(`/api/pathways/enrollments/${enrollmentId}`, { data: { isCurrent: true } })
    expect(res.status()).toBe(404)
  })

  test('a member removes an enrollment', async ({ apiAs }) => {
    const member = await apiAs('member')
    const del = await member.delete(`/api/pathways/enrollments/${enrollmentId}`)
    expect(del.ok(), await del.text()).toBeTruthy()

    const data = await (await member.get('/api/pathways')).json()
    expect(data.enrollments.some((e: { id: string }) => e.id === enrollmentId)).toBe(false)

    // Clean up the second enrollment too.
    const second = data.enrollments.find((e: { pathId: string }) => e.pathId === pathBId)
    if (second) await member.delete(`/api/pathways/enrollments/${second.id}`)
  })
})
