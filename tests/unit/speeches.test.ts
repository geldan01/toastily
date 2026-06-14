import { describe, expect, it } from 'vitest'
import { agendaSpeechMinutes, type SpeechTiming } from '../../server/utils/speeches'

/**
 * Agenda time allotment for a speech (PRD §6.3): the club-configurable max plus
 * a buffer for transitions/applause. `speechTiming()` itself reads the DB
 * (settings) so it is covered at the integration layer; the pure arithmetic in
 * `agendaSpeechMinutes` is pinned here.
 */
describe('agendaSpeechMinutes', () => {
  const timing: SpeechTiming = { defaultMin: 5, defaultMax: 7, buffer: 2 }

  it('adds the buffer to an explicit max', () => {
    expect(agendaSpeechMinutes(7, timing)).toBe(9)
    expect(agendaSpeechMinutes(10, timing)).toBe(12)
  })

  it('falls back to the default max when max is null/undefined', () => {
    expect(agendaSpeechMinutes(null, timing)).toBe(9) // 7 + 2
    expect(agendaSpeechMinutes(undefined, timing)).toBe(9)
  })

  it('respects a non-standard buffer', () => {
    expect(agendaSpeechMinutes(7, { defaultMin: 4, defaultMax: 6, buffer: 0 })).toBe(7)
    expect(agendaSpeechMinutes(7, { defaultMin: 4, defaultMax: 6, buffer: 5 })).toBe(12)
  })

  it('treats an explicit 0 max as 0 (not a missing value)', () => {
    expect(agendaSpeechMinutes(0, timing)).toBe(2) // 0 + buffer, NOT the default
  })
})
