import { eq, inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Meeting-minutes API (issue #14, PRD §6). Pins the data-driven authority model:
 * a user may author/approve a meeting's minutes iff admin (always), OR holds a
 * `canManageMinutes` executive position (the seeded President), OR is the
 * meeting's minutes secretary (the member signed up on that meeting for a role
 * flagged `isMinutesSecretary` — the seeded Secretary). Plain members may READ
 * (member-gated GETs) but never write; guests are unauthenticated (401).
 *
 * Self-contained: spins up its own meeting on a unique future date and makes the
 * plain-member "manager" account that meeting's Secretary, so the contextual
 * (per-meeting) secretary path is exercised independent of executive rank.
 */
test.describe('minutes API', () => {
  test.describe.configure({ mode: 'serial' })

  // Unique, valid YYYY-MM-DD far in the future so reruns never clash (one
  // meeting per date is enforced with a 409).
  const meetingDate = (() => {
    const d = new Date(Date.UTC(2097, 0, 1))
    d.setUTCDate(d.getUTCDate() + (Date.now() % 20000))
    return d.toISOString().slice(0, 10)
  })()

  let meetingId = ''
  let secretaryRoleId = '' // Secretary — isMinutesSecretary
  let managerId = ''

  test.beforeAll(async () => {
    const db = testDb()
    const users = await db.select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(inArray(schema.users.email, [
        TEST_ACCOUNTS.member.email,
        TEST_ACCOUNTS.manager.email,
      ]))
    const byEmail = new Map(users.map(u => [u.email, u.id]))
    managerId = byEmail.get(TEST_ACCOUNTS.manager.email)!

    // The seeded role that confers minutes-secretary authority (Secretary).
    const [secretary] = await db.select({ id: schema.meetingRoles.id })
      .from(schema.meetingRoles)
      .where(eq(schema.meetingRoles.isMinutesSecretary, true))
      .limit(1)
    secretaryRoleId = secretary!.id
  })

  test('admin creates a meeting and makes the manager its Secretary', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const created = await admin.post('/api/admin/meetings', { data: { date: meetingDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    meetingId = (await created.json()).meeting.id

    // Sign the plain-member "manager" account up for the minutes-secretary role
    // on this meeting, so its contextual authority (not exec rank) is exercised.
    const assign = await admin.post('/api/meetings/signup', {
      data: { meetingId, roleId: secretaryRoleId, userId: managerId },
    })
    expect(assign.ok(), await assign.text()).toBeTruthy()
    expect((await assign.json()).signup.userId).toBe(managerId)
  })

  // --- Read gating -----------------------------------------------------------

  test('an unauthenticated request cannot read minutes detail (401)', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    const res = await guest.get(`/api/meetings/${meetingDate}/minutes`)
    expect(res.status()).toBe(401)
  })

  test('an unauthenticated request cannot read the minutes list (401)', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    const res = await guest.get('/api/meetings/minutes')
    expect(res.status()).toBe(401)
  })

  test('a member can read minutes detail (200)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.get(`/api/meetings/${meetingDate}/minutes`)
    expect(res.ok(), await res.text()).toBeTruthy()
  })

  test('a member can read the minutes list (200)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.get('/api/meetings/minutes')
    expect(res.ok(), await res.text()).toBeTruthy()
    expect(Array.isArray((await res.json()).minutes)).toBe(true)
  })

  // --- Detail shape ----------------------------------------------------------

  test('detail returns the documented shape; canManage reflects authority', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.get(`/api/meetings/${meetingDate}/minutes`)
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()

    expect(body.meetingId).toBe(meetingId)
    expect(body.date).toBe(meetingDate)
    expect(body).toHaveProperty('meetingNumber')
    expect(body).toHaveProperty('minutes') // null until submitted
    expect(Array.isArray(body.previous)).toBe(true)
    // Quorum shape only — don't pin threshold/history/met: other specs' meetings
    // share the test DB and may add prior attendance that yields a threshold.
    expect(body.quorum).toEqual(expect.objectContaining({
      members: expect.any(Number),
      guests: expect.any(Number),
      total: expect.any(Number),
      met: expect.any(Boolean),
    }))
    expect(body.quorum).toHaveProperty('threshold')
    expect(Array.isArray(body.quorum.history)).toBe(true)

    // Plain member cannot manage.
    expect(body.canManage).toBe(false)

    // Admin always can.
    const admin = await apiAs('admin')
    const asAdmin = await (await admin.get(`/api/meetings/${meetingDate}/minutes`)).json()
    expect(asAdmin.canManage).toBe(true)

    // The meeting's Secretary (contextual, plain member) can manage.
    const manager = await apiAs('manager')
    const asManager = await (await manager.get(`/api/meetings/${meetingDate}/minutes`)).json()
    expect(asManager.canManage).toBe(true)
  })

  test('detail for a date with no meeting returns the empty shape (meetingId null)', async ({ apiAs }) => {
    const member = await apiAs('member')
    // A valid, far-future date with no seeded/created meeting.
    const res = await member.get('/api/meetings/2096-12-25/minutes')
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.meetingId).toBeNull()
    expect(body.meetingNumber).toBeNull()
    expect(body.canManage).toBe(false)
    expect(body.minutes).toBeNull()
    expect(body.previous).toEqual([])
    // Lean empty quorum shape: no meeting → zero present counts, no
    // threshold/history and an unmet verdict.
    expect(body.quorum).toMatchObject({
      members: 0, guests: 0, total: 0,
      threshold: null, history: [], met: false,
    })
  })

  // --- Submit (PUT) ----------------------------------------------------------

  test('a plain member cannot submit minutes (403)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.put('/api/meetings/minutes', {
      data: { meetingId, newBusiness: 'Member should not be able to write this.' },
    })
    expect(res.status()).toBe(403)
  })

  test('a submit without meetingId is rejected (400)', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const res = await admin.put('/api/meetings/minutes', { data: {} })
    expect(res.status()).toBe(400)
  })

  test('a submit for a non-existent meeting is rejected (404)', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const res = await admin.put('/api/meetings/minutes', {
      data: { meetingId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.status()).toBe(404)
  })

  test('an authorized manager submits minutes; the five sections persist', async ({ apiAs }) => {
    const manager = await apiAs('manager') // this meeting's Secretary
    const res = await manager.put('/api/meetings/minutes', {
      data: {
        meetingId,
        unfinishedBusiness: 'Carried over: venue booking.',
        newBusiness: 'New: spring contest planning.',
        upcomingEvents: 'Area contest on the 14th.',
        specialReminders: 'Renew memberships.',
        generalEvaluatorMention: 'GE praised the timing discipline.',
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const { minutes } = await res.json()
    expect(minutes.unfinishedBusiness).toBe('Carried over: venue booking.')
    expect(minutes.newBusiness).toBe('New: spring contest planning.')
    expect(minutes.upcomingEvents).toBe('Area contest on the 14th.')
    expect(minutes.specialReminders).toBe('Renew memberships.')
    expect(minutes.generalEvaluatorMention).toBe('GE praised the timing discipline.')
    expect(minutes.submittedBy).toBe(managerId)
    expect(minutes.submittedAt).not.toBeNull()
    expect(minutes.approvalStatus).toBe('pending')
  })

  test('a second submit upserts the same row (no duplicate) with the latest content', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const res = await admin.put('/api/meetings/minutes', {
      data: { meetingId, newBusiness: 'Revised new business.' },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const { minutes } = await res.json()
    expect(minutes.newBusiness).toBe('Revised new business.')
    // Re-submitting clears unspecified sections (full upsert of the narrative).
    expect(minutes.unfinishedBusiness).toBeNull()

    // Still exactly one record for this meeting (asserted via the list).
    const list = await (await admin.get('/api/meetings/minutes')).json()
    const forMeeting = list.minutes.filter((m: { meetingId: string }) => m.meetingId === meetingId)
    expect(forMeeting).toHaveLength(1)
    expect(forMeeting[0].newBusiness).toBe('Revised new business.')
  })

  // --- Approve (PATCH) -------------------------------------------------------

  test('a plain member cannot approve minutes (403)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.patch('/api/meetings/minutes', {
      data: { meetingId, status: 'read' },
    })
    expect(res.status()).toBe(403)
  })

  test('an approve with an invalid status is rejected (400)', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const res = await admin.patch('/api/meetings/minutes', {
      data: { meetingId, status: 'bogus' },
    })
    expect(res.status()).toBe(400)
  })

  test('approving as read sets status read with approver + timestamp', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const res = await admin.patch('/api/meetings/minutes', {
      data: { meetingId, status: 'read' },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const { minutes } = await res.json()
    expect(minutes.approvalStatus).toBe('read')
    expect(minutes.approvedBy).not.toBeNull()
    expect(minutes.approvedAt).not.toBeNull()
    expect(minutes.amendmentNotes).toBeNull()
  })

  test('approving as amended persists the amendment notes', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const res = await admin.patch('/api/meetings/minutes', {
      data: { meetingId, status: 'amended', amendmentNotes: 'Corrected the attendee count.' },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const { minutes } = await res.json()
    expect(minutes.approvalStatus).toBe('amended')
    expect(minutes.amendmentNotes).toBe('Corrected the attendee count.')
    expect(minutes.approvedAt).not.toBeNull()
  })

  test('approving minutes that do not exist is rejected (404)', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    // Create a fresh meeting with no minutes row yet, then try to approve it.
    const otherDate = (() => {
      const d = new Date(Date.UTC(2095, 5, 15))
      d.setUTCDate(d.getUTCDate() + (Date.now() % 9000))
      return d.toISOString().slice(0, 10)
    })()
    const created = await admin.post('/api/admin/meetings', { data: { date: otherDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    const otherMeetingId = (await created.json()).meeting.id

    const res = await admin.patch('/api/meetings/minutes', {
      data: { meetingId: otherMeetingId, status: 'read' },
    })
    expect(res.status()).toBe(404)
  })

  // --- List ------------------------------------------------------------------

  test('the list includes the submitted meeting with its meeting + record fields', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.get('/api/meetings/minutes')
    expect(res.ok(), await res.text()).toBeTruthy()
    const { minutes } = await res.json()

    const row = minutes.find((m: { meetingId: string }) => m.meetingId === meetingId)
    expect(row, 'submitted minutes should appear in the list').toBeTruthy()
    expect(row.date).toBe(meetingDate)
    expect(row).toHaveProperty('meetingNumber')
    expect(row).toHaveProperty('id')
    expect(row.newBusiness).toBe('Revised new business.')
    expect(row.approvalStatus).toBe('amended')

    // Unsubmitted meetings are absent — the empty meeting created for the 404
    // case has no minutes row and must not appear.
    expect(minutes.every((m: { meetingId: string }) => m.id != null)).toBe(true)
  })

  // --- previous (the last 3 prior meetings, with their minutes status) -------
  //
  // `previous` on a meeting's detail = the up-to-3 most recent prior scheduled
  // meetings, newest-first, EACH with its minutes (null when none submitted yet)
  // so the secretary can read them and see each one's approval status — and
  // approve/amend the pending ones. Approved minutes STAY in the list (with their
  // updated status). These priors sit a few days BEFORE `meetingDate`; cleaned up
  // in afterAll so reruns start clean.

  const priorSubmittedId = { value: '' }
  const priorSubmittedDate = (() => {
    const d = new Date(`${meetingDate}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 2)
    return d.toISOString().slice(0, 10)
  })()
  const priorUnsubmittedId = { value: '' }
  const priorUnsubmittedDate = (() => {
    const d = new Date(`${meetingDate}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 3)
    return d.toISOString().slice(0, 10)
  })()

  test.afterAll(async ({ apiAs }) => {
    const admin = await apiAs('admin')
    for (const id of [priorSubmittedId.value, priorUnsubmittedId.value]) {
      if (id) await admin.delete(`/api/admin/meetings/${id}`)
    }
  })

  test('a prior with submitted minutes appears in previous (pending); a prior with none appears with null minutes', async ({ apiAs }) => {
    const admin = await apiAs('admin')

    // A prior meeting whose minutes get submitted (left pending).
    const submitted = await admin.post('/api/admin/meetings', { data: { date: priorSubmittedDate } })
    expect(submitted.ok(), await submitted.text()).toBeTruthy()
    priorSubmittedId.value = (await submitted.json()).meeting.id

    // A prior meeting with NO minutes — appears in `previous` with null minutes.
    const unsubmitted = await admin.post('/api/admin/meetings', { data: { date: priorUnsubmittedDate } })
    expect(unsubmitted.ok(), await unsubmitted.text()).toBeTruthy()
    priorUnsubmittedId.value = (await unsubmitted.json()).meeting.id

    // Submit (but do not approve) the prior's minutes.
    const submit = await admin.put('/api/meetings/minutes', {
      data: { meetingId: priorSubmittedId.value, newBusiness: 'Prior business pending approval.' },
    })
    expect(submit.ok(), await submit.text()).toBeTruthy()
    expect((await submit.json()).minutes.approvalStatus).toBe('pending')

    const member = await apiAs('member')
    const body = await (await member.get(`/api/meetings/${meetingDate}/minutes`)).json()
    expect(body.previous.length).toBeLessThanOrEqual(3)

    // The submitted prior appears with its (pending) minutes.
    const submittedEntry = body.previous.find((t: { meetingId: string }) => t.meetingId === priorSubmittedId.value)
    expect(submittedEntry, 'submitted prior should be in previous').toBeTruthy()
    expect(submittedEntry.minutes).not.toBeNull()
    expect(submittedEntry.minutes.approvalStatus).toBe('pending')
    expect(submittedEntry.minutes.newBusiness).toBe('Prior business pending approval.')
    expect(submittedEntry.date).toBe(priorSubmittedDate)

    // The unsubmitted prior also appears — but with null minutes.
    const unsubmittedEntry = body.previous.find((t: { meetingId: string }) => t.meetingId === priorUnsubmittedId.value)
    expect(unsubmittedEntry, 'unsubmitted prior should be in previous').toBeTruthy()
    expect(unsubmittedEntry.minutes).toBeNull()
  })

  test('once the prior is APPROVED (read), it STAYS in previous with status read', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const approve = await admin.patch('/api/meetings/minutes', {
      data: { meetingId: priorSubmittedId.value, status: 'read' },
    })
    expect(approve.ok(), await approve.text()).toBeTruthy()
    expect((await approve.json()).minutes.approvalStatus).toBe('read')

    const member = await apiAs('member')
    const body = await (await member.get(`/api/meetings/${meetingDate}/minutes`)).json()
    const entry = body.previous.find((t: { meetingId: string }) => t.meetingId === priorSubmittedId.value)
    expect(entry, 'approved prior should remain in previous').toBeTruthy()
    expect(entry.minutes.approvalStatus).toBe('read')
  })
})
