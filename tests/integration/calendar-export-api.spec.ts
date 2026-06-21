import { eq, inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Calendar export (ICS) + notification preferences (issue #59). Pins:
 *  - the public single-meeting .ics download (content type + VEVENT), incl. 404
 *    for a date with no meeting;
 *  - the member-gated personalised feed (401 for guests; the member's meeting
 *    appears once they hold a role on it);
 *  - the member notification-preference round-trip (the role-reminder opt-out).
 *
 * Self-contained: creates its own meeting on a unique future date and assigns
 * the seeded member a role on it.
 */
test.describe('calendar export + preferences API', () => {
  test.describe.configure({ mode: 'serial' })

  const meetingDate = (() => {
    const d = new Date(Date.UTC(2097, 0, 1))
    d.setUTCDate(d.getUTCDate() + (Date.now() % 20000))
    return d.toISOString().slice(0, 10)
  })()

  let meetingId = ''
  let roleId = ''
  let memberId = ''

  test.beforeAll(async () => {
    const db = testDb()
    const [member] = await db.select({ id: schema.users.id })
      .from(schema.users)
      .where(inArray(schema.users.email, [TEST_ACCOUNTS.member.email]))
    memberId = member!.id

    const [role] = await db.select({ id: schema.meetingRoles.id })
      .from(schema.meetingRoles)
      .where(eq(schema.meetingRoles.active, true))
      .limit(1)
    roleId = role!.id
  })

  test('admin creates a meeting and gives the member a role', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const created = await admin.post('/api/admin/meetings', { data: { date: meetingDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    meetingId = (await created.json()).meeting.id

    const assign = await admin.post('/api/meetings/signup', {
      data: { meetingId, roleId, userId: memberId },
    })
    expect(assign.ok(), await assign.text()).toBeTruthy()
  })

  test('the single-meeting .ics is public and well-formed', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    const res = await guest.get(`/api/meetings/${meetingDate}/calendar`)
    expect(res.ok(), await res.text()).toBeTruthy()
    expect(res.headers()['content-type']).toContain('text/calendar')
    const body = await res.text()
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('BEGIN:VEVENT')
    expect(body).toContain(`DTSTART:${meetingDate.replaceAll('-', '')}T`)
  })

  test('a date with no meeting returns 404', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    const res = await guest.get('/api/meetings/2099-12-31/calendar')
    expect(res.status()).toBe(404)
  })

  test('the personalised feed rejects guests with 401', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    const res = await guest.get('/api/meetings/calendar')
    expect(res.status()).toBe(401)
  })

  test('the personalised feed includes a meeting the member has a role on', async ({ apiAs }) => {
    const member = await apiAs('member')
    const res = await member.get('/api/meetings/calendar')
    expect(res.ok(), await res.text()).toBeTruthy()
    expect(res.headers()['content-type']).toContain('text/calendar')
    const body = await res.text()
    expect(body).toContain(`DTSTART:${meetingDate.replaceAll('-', '')}T`)
  })

  test('notification preferences round-trip for a member', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    expect((await guest.get('/api/me/preferences')).status()).toBe(401)

    const member = await apiAs('member')
    const initial = await member.get('/api/me/preferences')
    expect(initial.ok()).toBeTruthy()
    expect((await initial.json()).notifyRoleReminders).toBe(true)

    const off = await member.put('/api/me/preferences', { data: { notifyRoleReminders: false } })
    expect(off.ok()).toBeTruthy()
    expect((await off.json()).notifyRoleReminders).toBe(false)

    // Persisted.
    expect((await (await member.get('/api/me/preferences')).json()).notifyRoleReminders).toBe(false)

    // Restore so the shared member account doesn't leak this into other specs.
    await member.put('/api/me/preferences', { data: { notifyRoleReminders: true } })
  })
})
