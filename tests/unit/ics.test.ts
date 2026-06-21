import { describe, expect, it } from 'vitest'
import { buildIcsCalendar, escapeIcsText, foldIcsLine, icsLocalRange, type IcsEvent } from '../../server/utils/ics'

/**
 * Pure iCalendar (RFC 5545) helpers behind the meeting calendar export (issue
 * #59). The endpoints (auth + headers) are pinned at the integration layer; here
 * we pin the text escaping, the floating-local date arithmetic and the overall
 * VCALENDAR shape that a member's calendar app actually parses.
 */
describe('escapeIcsText', () => {
  it('escapes backslashes, commas, semicolons and newlines', () => {
    expect(escapeIcsText('a, b; c\\d')).toBe('a\\, b\\; c\\\\d')
    expect(escapeIcsText('line1\nline2')).toBe('line1\\nline2')
    expect(escapeIcsText('a\r\nb')).toBe('a\\nb')
  })
})

describe('icsLocalRange', () => {
  it('emits floating-local start/end stamps for the given duration', () => {
    expect(icsLocalRange('2026-07-13', '18:00', 120)).toEqual({
      start: '20260713T180000',
      end: '20260713T200000',
    })
  })

  it('rolls the end time past midnight correctly', () => {
    expect(icsLocalRange('2026-07-13', '23:30', 60)).toEqual({
      start: '20260713T233000',
      end: '20260714T003000',
    })
  })

  it('falls back to midnight start when the time is malformed', () => {
    expect(icsLocalRange('2026-07-13', 'oops', 30).start).toBe('20260713T000000')
  })
})

describe('foldIcsLine', () => {
  it('leaves short lines untouched', () => {
    expect(foldIcsLine('SUMMARY:hi')).toBe('SUMMARY:hi')
  })

  it('folds long lines with a leading space on continuations (CRLF)', () => {
    const long = `SUMMARY:${'x'.repeat(100)}`
    const folded = foldIcsLine(long)
    expect(folded).toContain('\r\n ')
    // No content line exceeds 75 octets.
    for (const part of folded.split('\r\n')) expect(part.length).toBeLessThanOrEqual(75)
  })
})

describe('buildIcsCalendar', () => {
  const event: IcsEvent = {
    uid: 'meeting-abc@toastily',
    date: '2026-07-13',
    startTime: '18:00',
    durationMinutes: 120,
    summary: 'Club #12 — Theme',
    location: '123 Main St',
    description: 'Agenda: https://example.org/meeting/2026-07-13',
    url: 'https://example.org/meeting/2026-07-13',
  }
  const ics = buildIcsCalendar([event], { calendarName: 'My Club', now: new Date('2026-06-20T12:00:00Z') })

  it('wraps events in a VCALENDAR/VEVENT with CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('BEGIN:VEVENT\r\n')
    expect(ics).toContain('END:VEVENT\r\n')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })

  it('includes the key event fields', () => {
    expect(ics).toContain('UID:meeting-abc@toastily')
    expect(ics).toContain('DTSTART:20260713T180000')
    expect(ics).toContain('DTEND:20260713T200000')
    expect(ics).toContain('DTSTAMP:20260620T120000Z')
    expect(ics).toContain('SUMMARY:Club #12 — Theme')
    expect(ics).toContain('LOCATION:123 Main St')
    expect(ics).toContain('X-WR-CALNAME:My Club')
  })

  it('omits optional lines when absent', () => {
    const bare = buildIcsCalendar([{ ...event, location: null, description: null, url: null }])
    expect(bare).not.toContain('LOCATION:')
    expect(bare).not.toContain('DESCRIPTION:')
    expect(bare).not.toContain('URL:')
  })
})
