import { eq, inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Signup reminder (issue #59): the "open roles & speech slots — please sign up"
 * email. Pins that its schedule is configurable by AGENDA (calendar) managers as
 * well as communication managers, that other templates' schedules stay
 * communication-only, and the per-member opt-out round-trip.
 *
 * Self-contained: grants the seeded `manager` account a calendar-only executive
 * position (write_meetings) so it has `canManageCalendar` but NOT
 * `canManageCommunication`, then removes it afterwards. No existing spec asserts
 * the manager account's capabilities, so this doesn't leak.
 */
const SIGNUP_KEY = 'unfilled_roles'
const OTHER_KEY = 'meeting_role_reminder'

test.describe('signup reminder API', () => {
  test.describe.configure({ mode: 'serial' })

  let positionId = ''
  let managerId = ''
  const createdScheduleIds: string[] = []

  test.beforeAll(async () => {
    const db = testDb()
    const [manager] = await db.select({ id: schema.users.id })
      .from(schema.users)
      .where(inArray(schema.users.email, [TEST_ACCOUNTS.manager.email]))
    managerId = manager!.id

    const [pos] = await db.insert(schema.executivePositions)
      .values({ nameEn: 'Test Agenda Manager', nameFr: 'Resp. ordre du jour (test)', writeMeetings: true })
      .returning({ id: schema.executivePositions.id })
    positionId = pos!.id
    await db.insert(schema.executiveAssignments).values({ positionId, userId: managerId })
  })

  test.afterAll(async () => {
    const db = testDb()
    for (const id of createdScheduleIds) {
      await db.delete(schema.emailSchedules).where(eq(schema.emailSchedules.id, id))
    }
    // Removing the position cascades its assignment.
    if (positionId) await db.delete(schema.executivePositions).where(eq(schema.executivePositions.id, positionId))
  })

  test('the manager now holds calendar but not communication capability', async ({ apiAs }) => {
    const res = await (await apiAs('manager')).get('/api/me/capabilities')
    const caps = await res.json()
    expect(caps.canManageCalendar).toBe(true)
    expect(caps.canManageCommunication).toBe(false)
  })

  test('a plain member cannot list email schedules (403)', async ({ apiAs }) => {
    const res = await (await apiAs('member')).get('/api/admin/email-schedules')
    expect(res.status()).toBe(403)
  })

  test('a calendar manager may list schedules and create the signup reminder', async ({ apiAs }) => {
    const mgr = await apiAs('manager')
    expect((await mgr.get('/api/admin/email-schedules')).ok()).toBeTruthy()

    const created = await mgr.post('/api/admin/email-schedules', {
      data: { templateKey: SIGNUP_KEY, dayOfWeek: 1, timeOfDay: '08:30', active: true },
    })
    expect(created.ok(), await created.text()).toBeTruthy()
    const schedule = (await created.json()).schedule
    createdScheduleIds.push(schedule.id)

    // ...and edit its day/time/active.
    const patched = await mgr.patch(`/api/admin/email-schedules/${schedule.id}`, { data: { active: false } })
    expect(patched.ok(), await patched.text()).toBeTruthy()
    expect((await patched.json()).schedule.active).toBe(false)
  })

  test('a calendar manager may NOT schedule a different template (403)', async ({ apiAs }) => {
    const res = await (await apiAs('manager')).post('/api/admin/email-schedules', {
      data: { templateKey: OTHER_KEY, dayOfWeek: 2, timeOfDay: '10:00', active: true },
    })
    expect(res.status()).toBe(403)
  })

  test('a calendar manager may NOT edit email templates (403)', async ({ apiAs }) => {
    const res = await (await apiAs('manager')).put(`/api/admin/email-templates/${SIGNUP_KEY}`, {
      data: { subjectEn: 'x', subjectFr: 'x', bodyEn: 'x', bodyFr: 'x' },
    })
    expect(res.status()).toBe(403)
  })

  test('the signup-reminder opt-out round-trips for a member', async ({ apiAs }) => {
    const member = await apiAs('member')
    expect((await (await member.get('/api/me/preferences')).json()).notifySignupReminders).toBe(true)

    const off = await member.put('/api/me/preferences', { data: { notifySignupReminders: false } })
    expect((await off.json()).notifySignupReminders).toBe(false)
    expect((await (await member.get('/api/me/preferences')).json()).notifySignupReminders).toBe(false)

    // Restore for other specs sharing the member account.
    await member.put('/api/me/preferences', { data: { notifySignupReminders: true } })
  })
})
