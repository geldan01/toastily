import { and, eq, inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Contextual meeting authority (PRD §3, "data not role name"). A plain member
 * who holds a role flagged `grantsMeetingAuthority` (seeded on the Toastmaster)
 * on a given meeting becomes a manager FOR THAT MEETING — able to assign members
 * or guests and reassign filled roles — independent of executive rank. A member
 * without that role may only self-claim open roles, never assign others.
 *
 * Self-contained: spins up its own meeting on a unique date and reads role/user
 * ids from the DB so it never collides with other specs.
 */
test.describe('meeting signup authority', () => {
  test.describe.configure({ mode: 'serial' })

  // Unique, valid YYYY-MM-DD far in the future so reruns never clash (one
  // meeting per date is enforced with a 409).
  const meetingDate = (() => {
    const d = new Date(Date.UTC(2099, 0, 1))
    d.setUTCDate(d.getUTCDate() + (Date.now() % 20000))
    return d.toISOString().slice(0, 10)
  })()

  let meetingId = ''
  let authorityRoleId = '' // Toastmaster — grantsMeetingAuthority
  let openRoleA = ''
  let openRoleB = ''
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

    // Two ordinary, non-authority, active roles to assign/claim.
    const ordinary = await db.select({ id: schema.meetingRoles.id })
      .from(schema.meetingRoles)
      .where(and(
        eq(schema.meetingRoles.active, true),
        eq(schema.meetingRoles.grantsMeetingAuthority, false),
      ))
      .limit(2)
    openRoleA = ordinary[0]!.id
    openRoleB = ordinary[1]!.id
  })

  test('admin creates a meeting and makes the manager its Toastmaster', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const created = await admin.post('/api/admin/meetings', { data: { date: meetingDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    meetingId = (await created.json()).meeting.id

    // Assign the authority-granting role to the plain-member "manager" account.
    const assign = await admin.post('/api/meetings/signup', {
      data: { meetingId, roleId: authorityRoleId, userId: managerId },
    })
    expect(assign.ok()).toBeTruthy()
    expect((await assign.json()).signup.userId).toBe(managerId)
  })

  test('a plain member self-claims an open role but cannot assign others', async ({ apiAs }) => {
    const member = await apiAs('member')
    // Member targets the officer, but lacking authority the assignment is
    // coerced to a self-claim — proof they cannot assign someone else.
    const res = await member.post('/api/meetings/signup', {
      data: { meetingId, roleId: openRoleA, userId: officerId },
    })
    expect(res.ok()).toBeTruthy()
    expect((await res.json()).signup.userId).toBe(memberId)
  })

  test('a plain member cannot take an already-filled role (409)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.post('/api/meetings/signup', {
      data: { meetingId, roleId: authorityRoleId }, // held by the manager
    })
    expect(res.status()).toBe(409)
  })

  test('the contextual manager can assign a guest to an open role', async ({ apiAs }) => {
    const manager = await apiAs('manager')
    const res = await manager.post('/api/meetings/signup', {
      data: { meetingId, roleId: openRoleB, guestName: 'Visiting Speaker' },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const { signup } = await res.json()
    expect(signup.guestName).toBe('Visiting Speaker')
    expect(signup.userId).toBeNull()
  })

  test('the contextual manager can reassign a filled role', async ({ apiAs }) => {
    const manager = await apiAs('manager')
    // openRoleA is held by the member; the manager reassigns it to the officer.
    const res = await manager.post('/api/meetings/signup', {
      data: { meetingId, roleId: openRoleA, userId: officerId },
    })
    expect(res.ok()).toBeTruthy()
    expect((await res.json()).signup.userId).toBe(officerId)
  })
})
