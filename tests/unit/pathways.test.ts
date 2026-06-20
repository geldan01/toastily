import { describe, expect, it } from 'vitest'
import { isValidLevel, PATHWAYS_LEVELS } from '../../server/utils/pathways'

/**
 * Pathways progress tracker (issue #58). The DB-backed aggregation
 * (`memberTracker`) and ownership/link helpers are exercised at the integration
 * layer; here we pin the pure level rule that gates every project mutation.
 */
describe('isValidLevel', () => {
  it('accepts the five Pathways levels', () => {
    for (const n of PATHWAYS_LEVELS) expect(isValidLevel(n)).toBe(true)
  })

  it('rejects out-of-range, zero and negative values', () => {
    expect(isValidLevel(0)).toBe(false)
    expect(isValidLevel(6)).toBe(false)
    expect(isValidLevel(-1)).toBe(false)
  })

  it('rejects non-integers and non-numbers', () => {
    expect(isValidLevel(2.5)).toBe(false)
    expect(isValidLevel('3')).toBe(false)
    expect(isValidLevel(null)).toBe(false)
    expect(isValidLevel(undefined)).toBe(false)
    expect(isValidLevel(Number.NaN)).toBe(false)
  })

  it('covers exactly levels 1–5', () => {
    expect([...PATHWAYS_LEVELS]).toEqual([1, 2, 3, 4, 5])
  })
})
