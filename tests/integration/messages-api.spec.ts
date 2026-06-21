import { eq, inArray } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'
import { schema, testDb } from '../setup/test-db'

/**
 * Internal announcements contract (issues #17/#63, PRD §7.1). Reading is gated
 * to members; authoring and deletion to **communication managers**
 * (`canManageCommunication`) — not a hard-coded role, so a plain officer can't
 * post. Announcements are bilingual user-generated content: all four EN/FR
 * title + body fields are required. Posting can optionally fan out to members'
 * inboxes via the notifications pipeline.
 *
 * Self-contained: grants the seeded `manager` account a communication-writing
 * executive position in beforeAll (so it has `canManageCommunication`), then
 * removes it afterwards.
 */
const VALID_BODY = {
  titleEn: 'Title EN',
  titleFr: 'Titre FR',
  bodyEn: 'Body EN',
  bodyFr: 'Corps FR',
}

test.describe('messages API', () => {
  test.describe.configure({ mode: 'serial' })

  let positionId = ''

  test.beforeAll(async () => {
    const db = testDb()
    const [manager] = await db.select({ id: schema.users.id })
      .from(schema.users)
      .where(inArray(schema.users.email, [TEST_ACCOUNTS.manager.email]))
    const [pos] = await db.insert(schema.executivePositions)
      .values({ nameEn: 'Test Comms Manager', nameFr: 'Resp. communication (test)', writeCommunication: true })
      .returning({ id: schema.executivePositions.id })
    positionId = pos!.id
    await db.insert(schema.executiveAssignments).values({ positionId, userId: manager!.id })
  })

  test.afterAll(async () => {
    const db = testDb()
    // Removing the position cascades its assignment.
    if (positionId) await db.delete(schema.executivePositions).where(eq(schema.executivePositions.id, positionId))
  })

  test('rejects anonymous list with 401', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).get('/api/messages')
    expect(res.status()).toBe(401)
  })

  test('lets a member list announcements', async ({ apiAs }) => {
    const res = await (await apiAs('member')).get('/api/messages')
    expect(res.ok()).toBeTruthy()
    expect(Array.isArray((await res.json()).messages)).toBe(true)
  })

  test('rejects a plain member from posting with 403', async ({ apiAs }) => {
    const res = await (await apiAs('member')).post('/api/messages', { data: VALID_BODY })
    expect(res.status()).toBe(403)
  })

  test('rejects a plain officer (no communication capability) with 403', async ({ apiAs }) => {
    const res = await (await apiAs('officer')).post('/api/messages', { data: VALID_BODY })
    expect(res.status()).toBe(403)
  })

  test('rejects a missing French body with 400 (bilingual required)', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).post('/api/messages', {
      data: { ...VALID_BODY, bodyFr: '   ' },
    })
    expect(res.status()).toBe(400)
  })

  test('a communication manager posts, members see it, and it can be deleted', async ({ apiAs }) => {
    const mgr = await apiAs('manager')
    const stamp = Date.now()
    const data = {
      titleEn: `Announcement ${stamp}`,
      titleFr: `Annonce ${stamp}`,
      bodyEn: 'Hello members',
      bodyFr: 'Bonjour les membres',
      pinned: true,
    }

    const created = await mgr.post('/api/messages', { data })
    expect(created.ok()).toBeTruthy()
    const { message } = await created.json()
    expect(message.titleEn).toBe(data.titleEn)
    expect(message.titleFr).toBe(data.titleFr)
    expect(message.bodyFr).toBe(data.bodyFr)
    expect(message.pinned).toBe(true)

    // A member sees it in the list.
    const member = await apiAs('member')
    const list = await (await member.get('/api/messages')).json()
    expect(list.messages.some((m: { id: string }) => m.id === message.id)).toBe(true)

    // A member cannot delete it.
    const memberDelete = await member.delete(`/api/messages/${message.id}`)
    expect(memberDelete.status()).toBe(403)

    // The communication manager can delete it.
    const mgrDelete = await mgr.delete(`/api/messages/${message.id}`)
    expect(mgrDelete.ok()).toBeTruthy()

    // It's gone afterwards.
    const after = await (await member.get('/api/messages')).json()
    expect(after.messages.some((m: { id: string }) => m.id === message.id)).toBe(false)
  })

  test('optional email fan-out is reported on the response', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const stamp = Date.now()
    const created = await admin.post('/api/messages', {
      data: {
        titleEn: `Emailed ${stamp}`,
        titleFr: `Courriel ${stamp}`,
        bodyEn: 'Body',
        bodyFr: 'Corps',
        sendEmail: true,
      },
    })
    expect(created.ok()).toBeTruthy()
    const { message, email } = await created.json()
    // Email is stubbed in the test env (no Resend key) but still reported with a
    // recipient count for the member roster.
    expect(email).not.toBeNull()
    expect(['sent', 'stubbed']).toContain(email.status)
    expect(email.recipientCount).toBeGreaterThanOrEqual(1)
    await admin.delete(`/api/messages/${message.id}`)
  })

  test('expired announcements are hidden from the list', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const stamp = Date.now()
    const created = await admin.post('/api/messages', {
      data: { titleEn: `Expired ${stamp}`, titleFr: `Expirée ${stamp}`, bodyEn: 'x', bodyFr: 'x', expiresAt: '2000-01-01' },
    })
    expect(created.ok()).toBeTruthy()

    const list = await (await admin.get('/api/messages')).json()
    expect(list.messages.some((m: { titleEn: string }) => m.titleEn === `Expired ${stamp}`)).toBe(false)
  })
})
