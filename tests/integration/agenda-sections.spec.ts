import { expect, test } from '../fixtures/roles'

interface AgendaLine {
  kind: 'item' | 'speech' | 'evaluation'
  section: 'administrative' | 'speeches' | 'table_topics' | 'evaluations' | 'opening' | 'closing'
  labelEn: string
}

/**
 * Issue #74: the standard template's opening administrative block is sectioned
 * `opening` and the closing block `closing`, so the agenda renders distinct
 * "Opening Ceremony" / "Closing Ceremony" headings instead of one shared
 * "Administrative Segment". The educative sections still sit between them.
 *
 * Self-contained: spins up its own meeting on a unique future date.
 */
test.describe('agenda opening/closing sections', () => {
  test.describe.configure({ mode: 'serial' })

  const meetingDate = (() => {
    const d = new Date(Date.UTC(2099, 0, 1))
    d.setUTCDate(d.getUTCDate() + (Date.now() % 20000))
    return d.toISOString().slice(0, 10)
  })()

  test('admin creates a meeting', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    const created = await admin.post('/api/admin/meetings', { data: { date: meetingDate } })
    expect(created.ok(), await created.text()).toBeTruthy()
  })

  test('the agenda sections opening before the educative block and closing after', async ({ request }) => {
    const res = await request.get(`/api/agenda/${meetingDate}`)
    expect(res.ok()).toBeTruthy()
    const { lines } = await res.json() as { lines: AgendaLine[] }

    const sections = lines.map(l => l.section)
    expect(sections).toContain('opening')
    expect(sections).toContain('closing')
    // No item is left on the deprecated `administrative` fallback by the seed.
    expect(sections).not.toContain('administrative')

    // Opening items come before any educative section; closing items come after.
    const firstEducative = lines.findIndex(l => ['speeches', 'table_topics', 'evaluations'].includes(l.section))
    const lastOpening = lines.map(l => l.section).lastIndexOf('opening')
    const firstClosing = sections.indexOf('closing')
    expect(lastOpening).toBeLessThan(firstEducative)
    expect(firstClosing).toBeGreaterThan(firstEducative)
  })
})
