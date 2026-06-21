import { inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Mentorship pairings (issue #62). Pins:
 *  - the write auth boundary: only a people-manager (admin / `canAssignOfficers`
 *    holder) may create or end a pairing — a plain member/officer gets 403, an
 *    anonymous caller 401;
 *  - validation (self-pairing rejected; non-members rejected);
 *  - the pairing surfaces on BOTH members' participation timelines
 *    ("Mentored by" on the mentee, "Mentoring" on the mentor);
 *  - a mentee has at most one current mentor — re-pairing ends the previous one;
 *  - DELETE soft-ends the pairing (it disappears from the current view).
 *
 * Mutates the shared seeded `*_test` DB, so every pairing created here is ended
 * and hard-deleted afterwards, leaving the seed state untouched.
 */
test.describe('mentorship API', () => {
  test.describe.configure({ mode: 'serial' })

  let memberId = ''
  let officerId = ''
  let adminId = ''

  test.beforeAll(async () => {
    const db = testDb()
    const rows = await db.select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(inArray(schema.users.email, [
        TEST_ACCOUNTS.member.email,
        TEST_ACCOUNTS.officer.email,
        TEST_ACCOUNTS.admin.email,
      ]))
    memberId = rows.find(r => r.email === TEST_ACCOUNTS.member.email)!.id
    officerId = rows.find(r => r.email === TEST_ACCOUNTS.officer.email)!.id
    adminId = rows.find(r => r.email === TEST_ACCOUNTS.admin.email)!.id
  })

  test('write is gated on the people capability', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    expect((await guest.post('/api/mentorships', { data: {} })).status()).toBe(401)
    expect((await guest.delete('/api/mentorships/whatever')).status()).toBe(401)

    // A plain member and a plain officer (no exec position) lack canAssignOfficers.
    for (const role of ['member', 'officer'] as const) {
      const api = await apiAs(role)
      expect((await api.post('/api/mentorships', {
        data: { mentorUserId: officerId, menteeUserId: memberId },
      })).status()).toBe(403)
      expect((await api.delete('/api/mentorships/whatever')).status()).toBe(403)
    }
  })

  test('validates self-pairing and member-only', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    expect((await admin.post('/api/mentorships', {
      data: { mentorUserId: memberId, menteeUserId: memberId },
    })).status()).toBe(400)
    expect((await admin.post('/api/mentorships', {
      data: { mentorUserId: officerId },
    })).status()).toBe(400)
  })

  test('pairing is visible on both pages, single current mentor, soft-end', async ({ apiAs }) => {
    const admin = await apiAs('admin')

    // officer mentors member.
    const created = await admin.post('/api/mentorships', {
      data: { mentorUserId: officerId, menteeUserId: memberId },
    })
    expect(created.ok(), await created.text()).toBeTruthy()
    const firstId = (await created.json()).id as string
    expect(firstId).toBeTruthy()

    // Mentee's page shows "Mentored by officer".
    const member = await apiAs('member')
    let menteeView = await (await member.get(`/api/participation/${memberId}`)).json()
    expect(menteeView.mentor?.userId).toBe(officerId)
    expect(menteeView.mentor?.name).toBe(TEST_ACCOUNTS.officer.name)

    // Mentor's page lists member among mentees.
    let mentorView = await (await member.get(`/api/participation/${officerId}`)).json()
    expect(mentorView.mentees.map((m: { userId: string }) => m.userId)).toContain(memberId)

    // Re-pair the mentee to admin — the previous (officer) pairing is ended.
    const repair = await admin.post('/api/mentorships', {
      data: { mentorUserId: adminId, menteeUserId: memberId },
    })
    expect(repair.ok(), await repair.text()).toBeTruthy()
    const secondId = (await repair.json()).id as string

    menteeView = await (await member.get(`/api/participation/${memberId}`)).json()
    expect(menteeView.mentor?.userId).toBe(adminId)

    mentorView = await (await member.get(`/api/participation/${officerId}`)).json()
    expect(mentorView.mentees.map((m: { userId: string }) => m.userId)).not.toContain(memberId)

    // End the current pairing — mentee has no mentor afterwards.
    const ended = await admin.delete(`/api/mentorships/${secondId}`)
    expect(ended.ok(), await ended.text()).toBeTruthy()
    menteeView = await (await member.get(`/api/participation/${memberId}`)).json()
    expect(menteeView.mentor).toBeNull()

    // Unknown id → 404.
    expect((await admin.delete('/api/mentorships/00000000-0000-0000-0000-000000000000')).status()).toBe(404)
  })

  test.afterAll(async () => {
    const db = testDb()
    await db.delete(schema.mentorships)
      .where(inArray(schema.mentorships.menteeUserId, [memberId, officerId, adminId]))
  })
})
