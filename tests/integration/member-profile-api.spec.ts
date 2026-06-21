import { inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Member profiles (issue #61). Pins:
 *  - the profile GET/PUT auth boundary (401 for guests) and round-trip
 *    (bio/goals/phone trimmed, empty ⇒ null; showContactInfo toggle);
 *  - contact-visibility on the roster: a member who opts out hides their
 *    email/phone from another member, but bio/goals stay visible and an admin
 *    still sees the contact details;
 *  - the same gate on the per-member participation timeline.
 *
 * Restores the member's profile afterwards so the shared account stays clean.
 */
test.describe('member profile API', () => {
  test.describe.configure({ mode: 'serial' })

  let memberId = ''

  test.beforeAll(async () => {
    const db = testDb()
    const [member] = await db.select({ id: schema.users.id })
      .from(schema.users)
      .where(inArray(schema.users.email, [TEST_ACCOUNTS.member.email]))
    memberId = member!.id
  })

  test('profile GET/PUT is member-gated and round-trips', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    expect((await guest.get('/api/me/profile')).status()).toBe(401)
    expect((await guest.put('/api/me/profile', { data: { bio: 'x' } })).status()).toBe(401)

    const member = await apiAs('member')
    const saved = await member.put('/api/me/profile', {
      data: {
        bio: '  Longtime member.  ',
        goals: 'Vocal variety',
        phone: '  555-0100  ',
        showContactInfo: true,
      },
    })
    expect(saved.ok(), await saved.text()).toBeTruthy()
    const body = await saved.json()
    expect(body.bio).toBe('Longtime member.')
    expect(body.goals).toBe('Vocal variety')
    expect(body.phone).toBe('555-0100')
    expect(body.showContactInfo).toBe(true)

    // Persisted, and blank strings clear to null.
    const cleared = await member.put('/api/me/profile', { data: { goals: '   ' } })
    expect((await cleared.json()).goals).toBeNull()
    // Partial update leaves the untouched field intact.
    expect((await (await member.get('/api/me/profile')).json()).bio).toBe('Longtime member.')
  })

  test('contact visibility gates email/phone on the roster', async ({ apiAs }) => {
    const member = await apiAs('member')
    await member.put('/api/me/profile', {
      data: { bio: 'Hello', goals: 'Listen actively', phone: '555-0100', showContactInfo: false },
    })

    // Another member cannot see the opted-out member's email/phone, but bio/goals show.
    const officer = await apiAs('officer')
    const rosterRes = await officer.get('/api/members/roster')
    expect(rosterRes.ok()).toBeTruthy()
    const row = (await rosterRes.json()).members.find((m: { id: string }) => m.id === memberId)
    expect(row).toBeTruthy()
    expect(row.email).toBeNull()
    expect(row.phone).toBeNull()
    expect(row.bio).toBe('Hello')
    expect(row.goals).toBe('Listen actively')

    // An admin always sees the contact details.
    const admin = await apiAs('admin')
    const adminRow = (await (await admin.get('/api/members/roster')).json())
      .members.find((m: { id: string }) => m.id === memberId)
    expect(adminRow.email).toBe(TEST_ACCOUNTS.member.email)
    expect(adminRow.phone).toBe('555-0100')

    // Re-enabling exposes the contact details again.
    await member.put('/api/me/profile', { data: { showContactInfo: true } })
    const row2 = (await (await officer.get('/api/members/roster')).json())
      .members.find((m: { id: string }) => m.id === memberId)
    expect(row2.email).toBe(TEST_ACCOUNTS.member.email)
  })

  test('contact visibility gates the participation timeline', async ({ apiAs }) => {
    const member = await apiAs('member')
    await member.put('/api/me/profile', { data: { phone: '555-0100', showContactInfo: false } })

    // Another member sees bio/goals but no contact details.
    const officer = await apiAs('officer')
    const seen = await (await officer.get(`/api/participation/${memberId}`)).json()
    expect(seen.member.email).toBeNull()
    expect(seen.member.phone).toBeNull()

    // The member themselves sees their own contact details.
    const mine = await (await member.get(`/api/participation/${memberId}`)).json()
    expect(mine.member.email).toBe(TEST_ACCOUNTS.member.email)
    expect(mine.member.phone).toBe('555-0100')
  })

  test.afterAll(async () => {
    const db = testDb()
    await db.update(schema.users)
      .set({ bio: null, goals: null, phone: null, showContactInfo: true })
      .where(inArray(schema.users.email, [TEST_ACCOUNTS.member.email]))
  })
})
