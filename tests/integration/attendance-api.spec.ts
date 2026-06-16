import { eq, inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Member attendance tracking (issue #35, PRD §9 check-in / §11 tracking). Pins
 * the two entry paths (member self check-in vs. meeting-manager records others),
 * the members-only auth boundary, dedup, the present count (members + guests as a
 * quorum aid), and that attendance flows through to /participation.
 *
 * Self-contained: own meeting on a unique date, makes the "manager" account the
 * meeting's Toastmaster (the seeded `grantsMeetingAuthority` role) so its
 * contextual authority is exercised independent of executive rank.
 */
test.describe('attendance API', () => {
  test.describe.configure({ mode: 'serial' })

  const meetingDate = (() => {
    const d = new Date(Date.UTC(2098, 0, 1))
    d.setUTCDate(d.getUTCDate() + (Date.now() % 20000))
    return d.toISOString().slice(0, 10)
  })()

  let meetingId = ''
  let authorityRoleId = ''
  let memberId = ''
  let officerId = ''
  let managerId = ''

  test.beforeAll(async () => {
    const db = testDb()
    const users = await db.select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(inArray(schema.users.email, [
        TEST_ACCOUNTS.member.email,
        TEST_ACCOUNTS.officer.email,
        TEST_ACCOUNTS.manager.email,
      ]))
    const byEmail = new Map(users.map(u => [u.email, u.id]))
    memberId = byEmail.get(TEST_ACCOUNTS.member.email)!
    officerId = byEmail.get(TEST_ACCOUNTS.officer.email)!
    managerId = byEmail.get(TEST_ACCOUNTS.manager.email)!

    const [authority] = await db.select({ id: schema.meetingRoles.id })
      .from(schema.meetingRoles)
      .where(eq(schema.meetingRoles.grantsMeetingAuthority, true))
      .limit(1)
    authorityRoleId = authority!.id
  })

  test('admin creates a meeting and makes the manager its Toastmaster', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const created = await admin.post('/api/admin/meetings', { data: { date: meetingDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    meetingId = (await created.json()).meeting.id

    const assign = await admin.post('/api/meetings/signup', {
      data: { meetingId, roleId: authorityRoleId, userId: managerId },
    })
    expect(assign.ok(), await assign.text()).toBeTruthy()
  })

  test('an unauthenticated request cannot mark attendance (401)', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    const res = await guest.post('/api/meetings/attendance', { data: { meetingId } })
    expect(res.status()).toBe(401)
  })

  test('a member self-checks-in (source self)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/meetings/attendance', { data: { meetingId } })
    expect(res.ok(), await res.text()).toBeTruthy()
    const { attendance, deduped } = await res.json()
    expect(deduped).toBe(false)
    expect(attendance.userId).toBe(memberId)
    expect(attendance.source).toBe('self')
    expect(attendance.recordedBy).toBeNull()
  })

  test('a repeat self check-in is deduped, not duplicated', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/meetings/attendance', { data: { meetingId } })
    expect(res.ok()).toBeTruthy()
    expect((await res.json()).deduped).toBe(true)
  })

  test('a plain member cannot record attendance for someone else (403)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/meetings/attendance', {
      data: { meetingId, userId: officerId },
    })
    expect(res.status()).toBe(403)
  })

  test('the contextual manager records another member (source secretary)', async ({ apiAs }) => {
    const manager = await apiAs('manager')
    const res = await manager.post('/api/meetings/attendance', {
      data: { meetingId, userId: officerId },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const { attendance } = await res.json()
    expect(attendance.userId).toBe(officerId)
    expect(attendance.source).toBe('secretary')
    expect(attendance.recordedBy).toBe(managerId)
  })

  test('the present count includes members and checked-in guests', async ({ apiAs }) => {
    // Add a guest check-in (public endpoint) so it counts toward the room total.
    const member = await apiAs('member')
    const guestCheckin = await member.post('/api/meetings/checkin', {
      data: { meetingId, name: 'Quorum Guest' },
    })
    expect(guestCheckin.ok(), await guestCheckin.text()).toBeTruthy()

    const res = await member.get(`/api/meetings/${meetingDate}/attendance`)
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    // member (self) + officer (by manager) = 2 members present.
    expect(body.count.members).toBeGreaterThanOrEqual(2)
    expect(body.count.guests).toBeGreaterThanOrEqual(1)
    expect(body.count.total).toBe(body.count.members + body.count.guests)
    expect(body.selfPresent).toBe(true)
    expect(body.present.some((p: { userId: string }) => p.userId === officerId)).toBeTruthy()
  })

  test('a member sees canManage true only as a meeting manager', async ({ apiAs }) => {
    const member = await apiAs('member')
    const asMember = await (await member.get(`/api/meetings/${meetingDate}/attendance`)).json()
    expect(asMember.canManage).toBe(false)

    const manager = await apiAs('manager')
    const asManager = await (await manager.get(`/api/meetings/${meetingDate}/attendance`)).json()
    expect(asManager.canManage).toBe(true)
  })

  test('attendance surfaces in the participation summary and timeline', async ({ apiAs }) => {
    const member = await apiAs('member')
    const summary = await (await member.get('/api/participation')).json()
    const row = summary.members.find((m: { id: string }) => m.id === memberId)
    expect(row.attended).toBeGreaterThanOrEqual(1)

    const timeline = await (await member.get(`/api/participation/${memberId}`)).json()
    expect(timeline.attendance.some((a: { date: string }) => a.date === meetingDate)).toBeTruthy()
  })

  test('a member can clear their own attendance; a plain member cannot clear others', async ({ apiAs }) => {
    const member = await apiAs('member')
    // Plain member cannot remove the officer's (manager-recorded) attendance.
    const forbidden = await member.delete('/api/meetings/attendance', {
      data: { meetingId, userId: officerId },
    })
    expect(forbidden.status()).toBe(403)

    // But can remove their own.
    const ok = await member.delete('/api/meetings/attendance', {
      data: { meetingId, userId: memberId },
    })
    expect(ok.ok(), await ok.text()).toBeTruthy()

    const after = await (await member.get(`/api/meetings/${meetingDate}/attendance`)).json()
    expect(after.selfPresent).toBe(false)
  })

  test('the manager can clear another member’s attendance', async ({ apiAs }) => {
    const manager = await apiAs('manager')
    const res = await manager.delete('/api/meetings/attendance', {
      data: { meetingId, userId: officerId },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
  })
})
