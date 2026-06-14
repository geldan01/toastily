import { describe, expect, it } from 'vitest'
import { hasMinRole, ROLE_ORDER } from '../../shared/utils/roles'

/**
 * The account-level access ladder (PRD §3.1) is the spine of RBAC — every
 * server middleware and UI gate calls `hasMinRole`. These cases pin the ladder
 * order and the defensive handling of unknown / missing statuses.
 */
describe('hasMinRole', () => {
  const ladder = ['guest', 'member', 'officer', 'admin'] as const

  it('treats every status as meeting its own threshold', () => {
    for (const status of ladder) {
      expect(hasMinRole(status, status)).toBe(true)
    }
  })

  it('grants higher statuses access to lower thresholds', () => {
    expect(hasMinRole('admin', 'guest')).toBe(true)
    expect(hasMinRole('admin', 'member')).toBe(true)
    expect(hasMinRole('admin', 'officer')).toBe(true)
    expect(hasMinRole('officer', 'member')).toBe(true)
    expect(hasMinRole('member', 'guest')).toBe(true)
  })

  it('denies lower statuses access to higher thresholds', () => {
    expect(hasMinRole('guest', 'member')).toBe(false)
    expect(hasMinRole('member', 'officer')).toBe(false)
    expect(hasMinRole('officer', 'admin')).toBe(false)
    expect(hasMinRole('guest', 'admin')).toBe(false)
  })

  it('encodes "officer implies member" (PRD §3.1)', () => {
    expect(hasMinRole('officer', 'member')).toBe(true)
    expect(hasMinRole('admin', 'member')).toBe(true)
  })

  it('returns false for null / undefined / empty status', () => {
    expect(hasMinRole(null, 'guest')).toBe(false)
    expect(hasMinRole(undefined, 'guest')).toBe(false)
    expect(hasMinRole('', 'guest')).toBe(false)
  })

  it('returns false for an unknown status rather than throwing', () => {
    expect(hasMinRole('superadmin', 'admin')).toBe(false)
    expect(hasMinRole('Guest', 'guest')).toBe(false) // case-sensitive on purpose
  })

  it('orders the ladder guest < member < officer < admin', () => {
    expect(ROLE_ORDER.guest).toBeLessThan(ROLE_ORDER.member)
    expect(ROLE_ORDER.member).toBeLessThan(ROLE_ORDER.officer)
    expect(ROLE_ORDER.officer).toBeLessThan(ROLE_ORDER.admin)
  })
})
