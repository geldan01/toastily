import { expect, test } from '../fixtures/roles'

/**
 * Effective-capabilities contract (PRD §3.1/§3.2). The single source of truth
 * for management-UI visibility, and the server still enforces each capability
 * independently. Admin holds everything; a plain member/officer (no executive
 * position, no delegated grant) holds nothing; anonymous holds nothing.
 */
const NONE = { canManageCalendar: false, canManageContent: false, canAssignOfficers: false }
const ALL = { canManageCalendar: true, canManageContent: true, canAssignOfficers: true }

test.describe('capabilities API', () => {
  test('admin holds every capability', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).get('/api/me/capabilities')
    expect(await res.json()).toMatchObject(ALL)
  })

  test('a plain member holds no management capabilities', async ({ apiAs }) => {
    const res = await (await apiAs('member')).get('/api/me/capabilities')
    expect(await res.json()).toMatchObject(NONE)
  })

  test('a plain officer (no exec position) holds no capabilities', async ({ apiAs }) => {
    const res = await (await apiAs('officer')).get('/api/me/capabilities')
    expect(await res.json()).toMatchObject(NONE)
  })

  test('anonymous holds no capabilities', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).get('/api/me/capabilities')
    expect(await res.json()).toMatchObject(NONE)
  })
})
