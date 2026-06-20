import { describe, expect, it } from 'vitest'
import { isValidRating } from '../../server/utils/evaluations'

/**
 * Written evaluations (issue #60). The eligibility check (`isCheckedIn`) hits the
 * database and is exercised at the integration layer; here we pin the pure star
 * rating rule that gates every submission.
 */
describe('isValidRating', () => {
  it('accepts whole numbers 1 through 5', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(isValidRating(n)).toBe(true)
  })

  it('rejects out-of-range, zero and negative values', () => {
    expect(isValidRating(0)).toBe(false)
    expect(isValidRating(6)).toBe(false)
    expect(isValidRating(-1)).toBe(false)
  })

  it('rejects non-integers and non-numbers', () => {
    expect(isValidRating(3.5)).toBe(false)
    expect(isValidRating(Number.NaN)).toBe(false)
    expect(isValidRating('3')).toBe(false)
    expect(isValidRating(null)).toBe(false)
    expect(isValidRating(undefined)).toBe(false)
  })
})
