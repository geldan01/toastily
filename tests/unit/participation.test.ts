import { describe, expect, it } from 'vitest'
import { sessionWinnerUserIds } from '../../server/utils/participation'

/**
 * Award-win selection (PRD §11). This pure rule decides which members count an
 * award in their participation history, so the edge cases — ties, excluded
 * candidates, the >0 floor, and guest (no-userId) winners — are pinned here.
 * The DB-bound aggregation around it is covered by the integration layer.
 */
describe('sessionWinnerUserIds', () => {
  const votes = (pairs: [string, number][]) => new Map(pairs)

  it('returns the single top-voted member', () => {
    const cands = [
      { id: 'a', userId: 'u-a', excluded: false },
      { id: 'b', userId: 'u-b', excluded: false },
    ]
    expect(sessionWinnerUserIds(cands, votes([['a', 3], ['b', 1]]))).toEqual(['u-a'])
  })

  it('returns every member tied for the top count', () => {
    const cands = [
      { id: 'a', userId: 'u-a', excluded: false },
      { id: 'b', userId: 'u-b', excluded: false },
      { id: 'c', userId: 'u-c', excluded: false },
    ]
    expect(sessionWinnerUserIds(cands, votes([['a', 2], ['b', 2], ['c', 1]])).sort())
      .toEqual(['u-a', 'u-b'])
  })

  it('ignores excluded candidates even when they have the most votes', () => {
    const cands = [
      { id: 'a', userId: 'u-a', excluded: true },
      { id: 'b', userId: 'u-b', excluded: false },
    ]
    expect(sessionWinnerUserIds(cands, votes([['a', 5], ['b', 2]]))).toEqual(['u-b'])
  })

  it('returns no winner when nobody received a vote', () => {
    const cands = [
      { id: 'a', userId: 'u-a', excluded: false },
      { id: 'b', userId: 'u-b', excluded: false },
    ]
    expect(sessionWinnerUserIds(cands, votes([]))).toEqual([])
  })

  it('skips a winning guest candidate (no userId)', () => {
    const cands = [
      { id: 'a', userId: null, excluded: false }, // guest, top votes
      { id: 'b', userId: 'u-b', excluded: false },
    ]
    expect(sessionWinnerUserIds(cands, votes([['a', 4], ['b', 1]]))).toEqual([])
  })
})
