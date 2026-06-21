import { describe, expect, it } from 'vitest'
import { earnedMilestones, MILESTONE_CATALOG, type MilestoneMetrics } from '../../server/utils/milestones'

/**
 * Achievements / milestones (issue #64). The DB aggregation that feeds the
 * metrics lives in `memberParticipation` (pinned at the integration layer);
 * here we pin the pure catalog rule — a badge is earned when its metric meets
 * or exceeds the threshold.
 */
const ZERO: MilestoneMetrics = {
  attended: 0,
  speeches: 0,
  evaluations: 0,
  roles: 0,
  distinctRoles: 0,
  chaired: 0,
  awards: 0,
}

describe('earnedMilestones', () => {
  it('awards nothing for a member with no participation', () => {
    expect(earnedMilestones(ZERO)).toEqual([])
  })

  it('earns a badge exactly at the threshold, not below', () => {
    expect(earnedMilestones({ ...ZERO, speeches: 0 }).some(m => m.key === 'first_speech')).toBe(false)
    expect(earnedMilestones({ ...ZERO, speeches: 1 }).some(m => m.key === 'first_speech')).toBe(true)
  })

  it('earns every lower tier once a higher count is reached', () => {
    const keys = earnedMilestones({ ...ZERO, speeches: 10 }).map(m => m.key)
    expect(keys).toContain('first_speech')
    expect(keys).toContain('five_speeches')
    expect(keys).toContain('ten_speeches')
  })

  it('keys the leadership badge off the chaired (authority-role) metric', () => {
    // Holding many ordinary roles must not grant "in the chair".
    expect(earnedMilestones({ ...ZERO, roles: 9, distinctRoles: 9 }).some(m => m.key === 'first_chair')).toBe(false)
    expect(earnedMilestones({ ...ZERO, chaired: 1 }).some(m => m.key === 'first_chair')).toBe(true)
  })

  it('preserves catalog order in the earned list', () => {
    const all: MilestoneMetrics = { attended: 99, speeches: 99, evaluations: 99, roles: 99, distinctRoles: 99, chaired: 99, awards: 99 }
    expect(earnedMilestones(all).map(m => m.key)).toEqual(MILESTONE_CATALOG.map(d => d.key))
  })

  it('exposes a category and threshold on each earned badge', () => {
    const [badge] = earnedMilestones({ ...ZERO, attended: 1 })
    expect(badge).toMatchObject({ key: 'first_meeting', category: 'attendance', threshold: 1 })
  })
})
