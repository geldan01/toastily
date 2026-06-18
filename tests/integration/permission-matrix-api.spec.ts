import { expect, test } from '../fixtures/roles'

/**
 * Per-position write-access matrix (issue #47). Each executive position carries
 * one boolean per functional group of the executive workspace
 * (people/meetings/content/communication/config); the Permissions page edits
 * them as a positions × groups matrix. Reading the positions is officer+, but
 * EDITING the matrix is admin-only (mirrors executive-positions PATCH) — the
 * site admin always manages every group and is not a row. Write access is tied
 * to the position, not its current holder.
 *
 * These specs mutate the shared seeded `*_test` DB, so every toggle is reverted
 * before the test ends — leaving the seed state untouched for the rest of the
 * suite.
 */

interface PositionRow {
  id: string
  nameEn: string
  nameFr: string
  active: boolean
  writePeople: boolean
  writeMeetings: boolean
  writeContent: boolean
  writeCommunication: boolean
  writeConfig: boolean
}

const GROUP_FIELDS = ['writePeople', 'writeMeetings', 'writeContent', 'writeCommunication', 'writeConfig'] as const

async function positions(api: import('@playwright/test').APIRequestContext): Promise<PositionRow[]> {
  const res = await api.get('/api/admin/executive-positions')
  expect(res.status()).toBe(200)
  return (await res.json()).positions as PositionRow[]
}

test.describe('permission matrix — shape', () => {
  test('every position exposes the five group write-access flags', async ({ apiAs }) => {
    const rows = await positions(await apiAs('admin'))
    expect(rows.length).toBeGreaterThan(0)
    for (const p of rows) {
      for (const f of GROUP_FIELDS) expect(typeof p[f]).toBe('boolean')
    }
  })

  test('the seeded President writes to every group; an officer can read the matrix', async ({ apiAs }) => {
    const rows = await positions(await apiAs('officer'))
    const president = rows.find(p => p.nameEn === 'President')
    expect(president, 'seed should include a President position').toBeTruthy()
    for (const f of GROUP_FIELDS) expect(president![f]).toBe(true)
  })
})

test.describe('permission matrix — edit authority', () => {
  test('a plain officer cannot edit the matrix (403)', async ({ apiAs }) => {
    const officer = await apiAs('officer')
    const [p] = await positions(officer)
    const res = await officer.patch(`/api/admin/executive-positions/${p.id}`, { data: { writeConfig: true } })
    expect(res.status()).toBe(403)
  })

  test('anonymous cannot edit the matrix (401)', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    const res = await guest.patch('/api/admin/executive-positions/whatever', { data: { writeConfig: true } })
    expect(res.status()).toBe(401)
  })

  test('admin toggles a single group cell and it persists, then reverts', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    // Pick a position that does NOT already write communication (Treasurer).
    const before = (await positions(admin)).find(p => p.nameEn === 'Treasurer')
    expect(before).toBeTruthy()
    expect(before!.writeCommunication).toBe(false)

    // Flip it on — only that one cell changes.
    const on = await admin.patch(`/api/admin/executive-positions/${before!.id}`, { data: { writeCommunication: true } })
    expect(on.status()).toBe(200)
    const mid = (await positions(admin)).find(p => p.id === before!.id)!
    expect(mid.writeCommunication).toBe(true)
    expect(mid.writePeople).toBe(before!.writePeople)
    expect(mid.writeMeetings).toBe(before!.writeMeetings)
    expect(mid.writeContent).toBe(before!.writeContent)
    expect(mid.writeConfig).toBe(before!.writeConfig)

    // Revert to keep the shared seed pristine.
    const off = await admin.patch(`/api/admin/executive-positions/${before!.id}`, { data: { writeCommunication: false } })
    expect(off.status()).toBe(200)
    const after = (await positions(admin)).find(p => p.id === before!.id)!
    expect(after.writeCommunication).toBe(false)
  })
})
