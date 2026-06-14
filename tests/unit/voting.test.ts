import { describe, expect, it } from 'vitest'
import { TABLE_TOPICS_CATEGORIES, VOTE_CATEGORIES } from '../../server/utils/voting'

/**
 * Award-category constants (PRD §8). These drive ballot creation and the
 * results UI, so their identity and ordering are part of the contract. The
 * candidate-derivation logic they feed is DB-bound and covered by the
 * integration layer (tests/integration/voting-api.spec.ts).
 */
describe('vote categories', () => {
  it('lists the four award categories in display order', () => {
    expect(VOTE_CATEGORIES).toEqual([
      'best_speaker',
      'best_evaluator',
      'best_table_topics_speaker',
      'best_table_topics_evaluator',
    ])
  })

  it('table-topics categories are the trailing two, run together', () => {
    expect(TABLE_TOPICS_CATEGORIES).toEqual([
      'best_table_topics_speaker',
      'best_table_topics_evaluator',
    ])
    for (const c of TABLE_TOPICS_CATEGORIES) {
      expect(VOTE_CATEGORIES).toContain(c)
    }
  })

  it('has no duplicate categories', () => {
    expect(new Set(VOTE_CATEGORIES).size).toBe(VOTE_CATEGORIES.length)
  })

  it('separates speech-derived from table-topics categories cleanly', () => {
    const speechDerived = VOTE_CATEGORIES.filter(c => !TABLE_TOPICS_CATEGORIES.includes(c))
    expect(speechDerived).toEqual(['best_speaker', 'best_evaluator'])
  })
})
