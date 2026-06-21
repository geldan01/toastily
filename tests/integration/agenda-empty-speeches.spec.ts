import { eq } from 'drizzle-orm'
import { expect, test } from '../fixtures/roles'
import { schema, testDb } from '../setup/test-db'

interface AgendaLine {
  kind: 'item' | 'speech' | 'evaluation'
  section: 'administrative' | 'speeches' | 'table_topics' | 'evaluations' | 'opening' | 'closing'
  durationMinutes: number | null
  who?: string | null
  placeholder?: boolean
}

/**
 * Issue #73: an empty Prepared Speeches block must still render its section —
 * the agenda emits a single `placeholder` line so the heading survives. The
 * Evaluations section is left untouched because the seeded template fills it
 * with evaluator items (Grammarian, General Evaluator), which keep it visible.
 *
 * Self-contained: spins up its own meeting on a unique future date.
 */
test.describe('agenda empty-speeches placeholder', () => {
  test.describe.configure({ mode: 'serial' })

  const meetingDate = (() => {
    const d = new Date(Date.UTC(2098, 0, 1))
    d.setUTCDate(d.getUTCDate() + (Date.now() % 20000))
    return d.toISOString().slice(0, 10)
  })()

  let meetingId = ''

  test('admin creates a speechless meeting', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const created = await admin.post('/api/admin/meetings', { data: { date: meetingDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
    meetingId = (await created.json()).meeting.id
  })

  test('the agenda shows a Prepared Speeches placeholder and no Evaluations placeholder', async ({ request }) => {
    const res = await request.get(`/api/agenda/${meetingDate}`)
    expect(res.ok()).toBeTruthy()
    const { lines } = await res.json() as { lines: AgendaLine[] }

    const speechPlaceholder = lines.find((l: AgendaLine) => l.section === 'speeches' && l.placeholder)
    expect(speechPlaceholder, 'expected a Prepared Speeches placeholder').toBeTruthy()
    expect(speechPlaceholder.durationMinutes).toBeNull()
    expect(speechPlaceholder.who ?? null).toBeNull()

    // The seeded template fills the Evaluations section with evaluator items, so
    // it stays visible without a placeholder.
    expect(lines.some((l: AgendaLine) => l.section === 'evaluations' && l.placeholder)).toBe(false)
    expect(lines.some((l: AgendaLine) => l.section === 'evaluations')).toBe(true)
  })

  test('a speech with a speaker replaces the placeholder', async ({ request }) => {
    const db = testDb()
    await db.insert(schema.speeches).values({
      meetingId,
      slot: 1,
      title: 'Test speech',
      presenterGuestName: 'Visiting Speaker',
    })

    const res = await request.get(`/api/agenda/${meetingDate}`)
    expect(res.ok()).toBeTruthy()
    const { lines } = await res.json() as { lines: AgendaLine[] }

    // No placeholder once a slot has a speaker, and a real speech line appears.
    expect(lines.some((l: AgendaLine) => l.section === 'speeches' && l.placeholder)).toBe(false)
    const speech = lines.find((l: AgendaLine) => l.kind === 'speech' && !l.placeholder)
    expect(speech, 'expected a real speech line').toBeTruthy()
    expect(speech.who).toBe('Visiting Speaker')

    await db.delete(schema.speeches).where(eq(schema.speeches.meetingId, meetingId))
  })
})
