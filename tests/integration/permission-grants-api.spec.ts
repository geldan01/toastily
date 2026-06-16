import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'

/**
 * Delegable permission-grants admin API (issue #13, PRD §3/§13). Grant/revoke
 * the per-user delegable capabilities (`content_edit` / `calendar_manage`) that
 * sit on top of the RBAC ladder. Authority mirrors `requireGrantManager`: admin
 * OR a `canAssignOfficers` holder (President); a plain member/officer is refused
 * 403, and an anonymous caller 401. Grants are append/temporal and idempotent;
 * revoke is a soft revoke (sets `revokedAt`) that drops the capability at once.
 *
 * These specs mutate the shared seeded `*_test` DB, so every grant created here
 * is revoked again before the test ends — leaving the seed state untouched for
 * the rest of the suite (which assumes the `member` account holds NO grants;
 * see capabilities-api.spec.ts).
 */

interface GrantRow {
  id: string
  userId: string
  userName: string
  capability: string
  createdAt: string
  grantedByName: string | null
}

/** Resolve the seeded `member` fixture account's userId via the admin members list. */
async function memberUserId(api: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await api.get('/api/admin/members')
  expect(res.status()).toBe(200)
  const { members } = (await res.json()) as { members: { id: string, email: string, status: string }[] }
  const row = members.find(m => m.email === TEST_ACCOUNTS.member.email)
  expect(row, `seeded member account ${TEST_ACCOUNTS.member.email} should be in the members list`).toBeTruthy()
  expect(row!.status).toBe('member')
  return row!.id
}

test.describe('permission-grants API — auth boundary', () => {
  test('anonymous callers get 401 from GET/POST/DELETE', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    expect((await guest.get('/api/admin/permission-grants')).status()).toBe(401)
    expect((await guest.post('/api/admin/permission-grants', { data: {} })).status()).toBe(401)
    expect((await guest.delete('/api/admin/permission-grants/whatever')).status()).toBe(401)
  })

  test('a plain member is refused with 403 from GET/POST/DELETE', async ({ apiAs }) => {
    const member = await apiAs('member')
    expect((await member.get('/api/admin/permission-grants')).status()).toBe(403)
    expect((await member.post('/api/admin/permission-grants', { data: {} })).status()).toBe(403)
    expect((await member.delete('/api/admin/permission-grants/whatever')).status()).toBe(403)
  })

  test('a plain officer (no exec position) is refused with 403 from GET/POST/DELETE', async ({ apiAs }) => {
    const officer = await apiAs('officer')
    expect((await officer.get('/api/admin/permission-grants')).status()).toBe(403)
    expect((await officer.post('/api/admin/permission-grants', { data: {} })).status()).toBe(403)
    expect((await officer.delete('/api/admin/permission-grants/whatever')).status()).toBe(403)
  })
})

test.describe('permission-grants API — POST validation', () => {
  test('missing userId → 400', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).post('/api/admin/permission-grants', {
      data: { capability: 'calendar_manage' },
    })
    expect(res.status()).toBe(400)
  })

  test('invalid capability → 400', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const userId = await memberUserId(admin)
    const res = await admin.post('/api/admin/permission-grants', {
      data: { userId, capability: 'not_a_capability' },
    })
    expect(res.status()).toBe(400)
  })

  test('unknown user → 404', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).post('/api/admin/permission-grants', {
      data: { userId: '00000000-0000-0000-0000-000000000000', capability: 'calendar_manage' },
    })
    expect(res.status()).toBe(404)
  })
})

/**
 * The full grant → effect → revoke → cleared lifecycle. Serial so the grant id
 * created in step 1 carries through; the revoke in step 4 (with an afterAll
 * safety net) restores the clean seed state.
 */
test.describe.serial('permission-grants API — grant/revoke lifecycle', () => {
  let userId = ''
  let grantId = ''

  test.afterAll(async ({ apiAs }) => {
    // Safety net: ensure nothing we created survives, even if a test failed midway.
    if (grantId) await (await apiAs('admin')).delete(`/api/admin/permission-grants/${grantId}`)
  })

  test('admin grants calendar_manage to a plain member → capability flips true', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    userId = await memberUserId(admin)

    // Baseline: the member holds no calendar-manage capability yet.
    const before = await (await apiAs('member')).get('/api/me/capabilities')
    expect((await before.json()).canManageCalendar).toBe(false)

    const res = await admin.post('/api/admin/permission-grants', {
      data: { userId, capability: 'calendar_manage' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.alreadyGranted).toBeFalsy()
    expect(body.grant.id).toBeTruthy()
    grantId = body.grant.id

    // The member's effective capabilities now include calendar management.
    const after = await (await apiAs('member')).get('/api/me/capabilities')
    expect((await after.json()).canManageCalendar).toBe(true)
  })

  test('the active grant appears in the GET list (no duplicates)', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).get('/api/admin/permission-grants')
    expect(res.status()).toBe(200)
    const { grants } = (await res.json()) as { grants: GrantRow[] }
    const mine = grants.filter(g => g.id === grantId)
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ userId, capability: 'calendar_manage' })
    expect(mine[0].grantedByName).toBe(TEST_ACCOUNTS.admin.name)
  })

  test('re-granting is idempotent → alreadyGranted:true, still no duplicate', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const res = await admin.post('/api/admin/permission-grants', {
      data: { userId, capability: 'calendar_manage' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.alreadyGranted).toBe(true)
    expect(body.grant.id).toBe(grantId)

    // The list still shows exactly one active grant for this capability + member.
    const { grants } = (await (await admin.get('/api/admin/permission-grants')).json()) as { grants: GrantRow[] }
    const active = grants.filter(g => g.userId === userId && g.capability === 'calendar_manage')
    expect(active).toHaveLength(1)
  })

  test('revoking (DELETE by id) drops the capability and removes it from the list', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const res = await admin.delete(`/api/admin/permission-grants/${grantId}`)
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    // Capability returns to false for the member.
    const caps = await (await apiAs('member')).get('/api/me/capabilities')
    expect((await caps.json()).canManageCalendar).toBe(false)

    // And the grant no longer appears in the active list.
    const { grants } = (await (await admin.get('/api/admin/permission-grants')).json()) as { grants: GrantRow[] }
    expect(grants.find(g => g.id === grantId)).toBeUndefined()

    grantId = '' // consumed — nothing for afterAll to clean up.
  })

  test('revoking an already-revoked / unknown grant id → 404', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    expect((await admin.delete('/api/admin/permission-grants/00000000-0000-0000-0000-000000000000')).status()).toBe(404)
  })
})
