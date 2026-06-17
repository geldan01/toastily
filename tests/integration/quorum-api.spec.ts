import { inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Quorum threshold API (issue #14 follow-up, PRD §6). The manual-override +
 * confirmation feature was REMOVED — there is no `PUT /api/meetings/quorum` and
 * no `members_present_manual`/`quorum_confirmed*` columns. The present count is
 * now derived ONLY from real member check-ins (`meeting_attendance`), so this
 * spec sets up known figures by creating real check-ins via
 * `POST /api/meetings/attendance`. Pins:
 *  - the headline threshold math: MAJORITY OF THE AVERAGE members present over
 *    the up-to-3 most recent prior meetings WITH attendance —
 *    `threshold = floor(avg / 2) + 1`, the average kept exact, floored at the end;
 *  - `quorum.history` carries those figures newest-first;
 *  - the `met` verdict flips false→true as the CURRENT meeting's member check-in
 *    count reaches the threshold; guest check-ins never affect members/met;
 *  - a meeting with no qualifying prior attendance → `threshold: null`, `met: false`.
 *
 * Member-count constraint: only four member+ accounts are seeded (member,
 * officer, admin, manager), so the most distinct member check-ins realizable on
 * any single meeting is 4. We therefore drive the formula with the deterministic
 * counts 2, 3, 4 (oldest→newest of the three priors): avg(2,3,4) = 3 →
 * floor(3/2)+1 = 2. History newest-first = [4, 3, 2].
 *
 * Self-contained: builds its own cluster of meetings on unique far-future dates
 * placed strictly BELOW the live minimum meeting date in the DB, so the lookback
 * sees exactly the priors this spec creates and nothing seeded/leftover. All
 * created meetings are deleted in `finally` so a rerun starts clean.
 */
test.describe('quorum API', () => {
  test.describe.configure({ mode: 'serial' })

  // Member+ accounts available for distinct check-ins (max 4 distinct members).
  let memberId = ''
  let officerId = ''
  let adminId = ''
  let managerId = ''

  // The cluster's dates, anchored below the live MIN meeting date (computed in
  // beforeAll) so no seeded/leftover meeting interferes with the lookback.
  let priorDates: string[] = [] // [oldest, mid, newest] → check-ins 2, 3, 4
  let currentDate = '' // the meeting under test (after the three priors)
  let nullDate = '' // a meeting with no qualifying prior data

  const priorMeetingIds: string[] = []
  let currentMeetingId = ''
  let nullMeetingId = ''

  test.beforeAll(async () => {
    const db = testDb()
    const users = await db.select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(inArray(schema.users.email, [
        TEST_ACCOUNTS.member.email,
        TEST_ACCOUNTS.officer.email,
        TEST_ACCOUNTS.admin.email,
        TEST_ACCOUNTS.manager.email,
      ]))
    const byEmail = new Map(users.map(u => [u.email, u.id]))
    memberId = byEmail.get(TEST_ACCOUNTS.member.email)!
    officerId = byEmail.get(TEST_ACCOUNTS.officer.email)!
    adminId = byEmail.get(TEST_ACCOUNTS.admin.email)!
    managerId = byEmail.get(TEST_ACCOUNTS.manager.email)!

    // Anchor the whole cluster at a FIXED low future date (2090), strictly BELOW
    // every other spec's meeting base (which all start at 2095+). This guarantees
    // (a) the quorum lookback before `currentDate` sees only the priors created
    // here — other specs' attendance-bearing meetings are all later — and (b) the
    // cluster's dates never collide with another spec's (e.g. the minutes spec's
    // meetingDate-2/-3 priors up at 2097+). A small per-run offset keeps reruns
    // from clashing with any orphaned rows. We then count up:
    // [nullDate] < [prior0] < [prior1] < [prior2] < [currentDate], all < 2095.
    const anchor = new Date(Date.UTC(2090, 0, 10))
    anchor.setUTCDate(anchor.getUTCDate() + (Date.now() % 1000))
    const dayBelow = (daysBelowAnchor: number) => {
      const d = new Date(anchor)
      d.setUTCDate(d.getUTCDate() - daysBelowAnchor)
      return d.toISOString().slice(0, 10)
    }
    // nullDate is the lowest (5 days below anchor); the cluster ascends from there.
    nullDate = dayBelow(5)
    priorDates = [dayBelow(4), dayBelow(3), dayBelow(2)] // oldest → newest
    currentDate = dayBelow(1) // strictly after all three priors, below anchor
  })

  test.afterAll(async ({ apiAs }) => {
    // Self-clean every meeting created so leftovers never become "priors with
    // attendance" for a later run (the test DB is shared across runs).
    const admin = await apiAs('admin')
    for (const id of [...priorMeetingIds, currentMeetingId, nullMeetingId]) {
      if (id) await admin.delete(`/api/admin/meetings/${id}`)
    }
  })

  // --- Setup: the meeting cluster --------------------------------------------

  test('admin creates the meeting cluster', async ({ apiAs }) => {
    const admin = await apiAs('admin')

    // The three priors that drive the headline threshold (oldest → newest).
    for (const d of priorDates) {
      const created = await admin.post('/api/admin/meetings', { data: { date: d } })
      expect(created.ok(), await created.text()).toBeTruthy()
      priorMeetingIds.push((await created.json()).meeting.id)
    }

    // The current meeting under test.
    const created = await admin.post('/api/admin/meetings', { data: { date: currentDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    currentMeetingId = (await created.json()).meeting.id
  })

  // --- 1. Threshold math (the headline) via REAL check-ins -------------------

  test('records 2/3/4 distinct member check-ins on the three priors', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    // priorDates is oldest→newest; check-in counts 2, 3, 4 respectively. The
    // admin records each member (source: 'secretary') — deterministic + distinct.
    const figures: string[][] = [
      [memberId, officerId], // prior[0] (oldest): 2 present
      [memberId, officerId, adminId], // prior[1]: 3 present
      [memberId, officerId, adminId, managerId], // prior[2] (newest): 4 present
    ]
    for (let i = 0; i < priorMeetingIds.length; i++) {
      for (const uid of figures[i]) {
        const res = await admin.post('/api/meetings/attendance', {
          data: { meetingId: priorMeetingIds[i], userId: uid },
        })
        expect(res.ok(), await res.text()).toBeTruthy()
      }
    }

    // Add a guest check-in to the newest prior to prove guests NEVER feed the
    // members figure / threshold.
    const guestIn = await admin.post('/api/meetings/checkin', {
      data: { meetingId: priorMeetingIds[2], name: 'Quorum Guest (should not count)' },
    })
    expect(guestIn.ok(), await guestIn.text()).toBeTruthy()
  })

  test('threshold = floor(avg(2,3,4)/2)+1 = 2; history is the 3 figures newest-first', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.get(`/api/meetings/${currentDate}/minutes`)
    expect(res.ok(), await res.text()).toBeTruthy()
    const { quorum } = await res.json()

    // avg(2,3,4) = 3 → floor(3/2)+1 = 1 + 1 = 2.
    expect(quorum.threshold).toBe(2)

    // History: the three most-recent priors with attendance, newest first. Each
    // entry carries date, meetingNumber, membersPresent (the member check-in
    // count) — guests excluded.
    expect(quorum.history).toHaveLength(3)
    for (const h of quorum.history) {
      expect(h).toEqual(expect.objectContaining({
        date: expect.any(String),
        membersPresent: expect.any(Number),
      }))
      expect(h).toHaveProperty('meetingNumber')
    }
    // Newest-first ordering: priorDates[2] (4 present) leads, then [1] (3), [0] (2).
    expect(quorum.history.map((h: { date: string }) => h.date)).toEqual([
      priorDates[2], priorDates[1], priorDates[0],
    ])
    expect(quorum.history.map((h: { membersPresent: number }) => h.membersPresent)).toEqual([4, 3, 2])
  })

  // --- 2. The `met` verdict on the current meeting ---------------------------

  test('met flips false→true as current member check-ins reach the threshold (2); guests never count', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const member = await apiAs('member')

    // Before any current-meeting check-in: 0 members, threshold 2 → not met.
    {
      const { quorum } = await (await member.get(`/api/meetings/${currentDate}/minutes`)).json()
      expect(quorum.threshold).toBe(2)
      expect(quorum.members).toBe(0)
      expect(quorum.met).toBe(false)
    }

    // A guest check-in must not move members/met (still 0 members, not met).
    {
      const guestIn = await admin.post('/api/meetings/checkin', {
        data: { meetingId: currentMeetingId, name: 'Current Guest (should not count)' },
      })
      expect(guestIn.ok(), await guestIn.text()).toBeTruthy()
      const { quorum } = await (await member.get(`/api/meetings/${currentDate}/minutes`)).json()
      expect(quorum.guests).toBeGreaterThanOrEqual(1)
      expect(quorum.members).toBe(0)
      expect(quorum.met).toBe(false)
    }

    // One member check-in: members 1 < threshold 2 → still not met.
    {
      const selfIn = await member.post('/api/meetings/attendance', { data: { meetingId: currentMeetingId } })
      expect(selfIn.ok(), await selfIn.text()).toBeTruthy()
      const { quorum } = await (await member.get(`/api/meetings/${currentDate}/minutes`)).json()
      expect(quorum.members).toBe(1)
      expect(quorum.met).toBe(false)
    }

    // Second distinct member check-in: members 2 ≥ threshold 2 → met flips true.
    {
      const otherIn = await admin.post('/api/meetings/attendance', {
        data: { meetingId: currentMeetingId, userId: officerId },
      })
      expect(otherIn.ok(), await otherIn.text()).toBeTruthy()
      const { quorum } = await (await member.get(`/api/meetings/${currentDate}/minutes`)).json()
      expect(quorum.members).toBe(2)
      expect(quorum.met).toBe(true)
    }
  })

  // --- 3. Null threshold (no qualifying prior attendance) --------------------

  test('a meeting with no qualifying prior attendance → threshold null, met false', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    // nullDate is the LOWEST date in the cluster (and below the live MIN meeting
    // date) — no scheduled prior meeting with attendance exists before it.
    const created = await admin.post('/api/admin/meetings', { data: { date: nullDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    nullMeetingId = (await created.json()).meeting.id

    // Even with current member check-ins, met stays false because threshold is null.
    const inA = await admin.post('/api/meetings/attendance', { data: { meetingId: nullMeetingId, userId: memberId } })
    expect(inA.ok(), await inA.text()).toBeTruthy()
    const inB = await admin.post('/api/meetings/attendance', { data: { meetingId: nullMeetingId, userId: officerId } })
    expect(inB.ok(), await inB.text()).toBeTruthy()

    const member = await apiAs('member')
    const { quorum } = await (await member.get(`/api/meetings/${nullDate}/minutes`)).json()
    expect(quorum.threshold).toBeNull()
    expect(quorum.history).toEqual([])
    expect(quorum.members).toBe(2)
    expect(quorum.met).toBe(false)
  })
})
