import { expect, test } from '../fixtures/roles'

/**
 * Internal announcements contract (issue #17, PRD §7.1). Reading is gated to
 * members; authoring and deletion to officers/admins. These specs pin the auth
 * boundary plus the create → list → delete round-trip.
 */
test.describe('messages API', () => {
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
    const res = await (await apiAs('member')).post('/api/messages', { data: { body: 'nope' } })
    expect(res.status()).toBe(403)
  })

  test('rejects an empty body with 400', async ({ apiAs }) => {
    const res = await (await apiAs('officer')).post('/api/messages', { data: { body: '   ' } })
    expect(res.status()).toBe(400)
  })

  test('an officer posts, members see it, and it can be deleted', async ({ apiAs }) => {
    const officer = await apiAs('officer')
    const unique = `Test announcement ${Date.now()}`

    const created = await officer.post('/api/messages', { data: { body: unique, pinned: true } })
    expect(created.ok()).toBeTruthy()
    const { message } = await created.json()
    expect(message.body).toBe(unique)
    expect(message.pinned).toBe(true)

    // A member sees it in the list.
    const member = await apiAs('member')
    const list = await (await member.get('/api/messages')).json()
    expect(list.messages.some((m: { id: string }) => m.id === message.id)).toBe(true)

    // A member cannot delete it.
    const memberDelete = await member.delete(`/api/messages/${message.id}`)
    expect(memberDelete.status()).toBe(403)

    // The officer can delete it.
    const officerDelete = await officer.delete(`/api/messages/${message.id}`)
    expect(officerDelete.ok()).toBeTruthy()

    // It's gone afterwards.
    const after = await (await member.get('/api/messages')).json()
    expect(after.messages.some((m: { id: string }) => m.id === message.id)).toBe(false)
  })

  test('expired announcements are hidden from the list', async ({ apiAs }) => {
    const officer = await apiAs('officer')
    const unique = `Expired ${Date.now()}`
    // Past expiry date ⇒ should never surface in the active list.
    const created = await officer.post('/api/messages', {
      data: { body: unique, expiresAt: '2000-01-01' },
    })
    expect(created.ok()).toBeTruthy()

    const list = await (await officer.get('/api/messages')).json()
    expect(list.messages.some((m: { body: string }) => m.body === unique)).toBe(false)
  })
})
