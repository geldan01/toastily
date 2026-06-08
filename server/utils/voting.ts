import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { useDrizzle } from '../db/client'
import { schema } from '../db/client'
import type { VoteCategory } from '../db/schema/voting'

/** The four award categories, in display order (PRD §8). */
export const VOTE_CATEGORIES: VoteCategory[] = [
  'best_speaker',
  'best_evaluator',
  'best_table_topics_speaker',
  'best_table_topics_evaluator',
]

/** Candidates derivable from the meeting's prepared speeches. Speaker and
 * evaluator categories pre-fill from the speech presenters/evaluators; the
 * table-topics categories have no participant data and start empty (the meeting
 * manager adds candidates live). The Grammarian, signed up to that role, is
 * added manually by the manager — we don't hard-code the role name. */
type DerivedCandidate = { userId: string | null, guestName: string | null }

export async function deriveCandidates(
  db: ReturnType<typeof useDrizzle>,
  meetingId: string,
  category: VoteCategory,
): Promise<DerivedCandidate[]> {
  if (category !== 'best_speaker' && category !== 'best_evaluator') return []

  const rows = await db.select({
    presenterUserId: schema.speeches.presenterUserId,
    presenterGuestName: schema.speeches.presenterGuestName,
    evaluatorUserId: schema.speeches.evaluatorUserId,
    evaluatorGuestName: schema.speeches.evaluatorGuestName,
  })
    .from(schema.speeches)
    .where(eq(schema.speeches.meetingId, meetingId))

  const byKey = new Map<string, DerivedCandidate>()
  for (const r of rows) {
    const userId = category === 'best_speaker' ? r.presenterUserId : r.evaluatorUserId
    const guestName = category === 'best_speaker' ? r.presenterGuestName : r.evaluatorGuestName
    if (!userId && !guestName) continue
    const key = userId ? `u:${userId}` : `g:${guestName!.toLowerCase()}`
    if (!byKey.has(key)) byKey.set(key, { userId, guestName })
  }
  return [...byKey.values()]
}

const VOTER_COOKIE = 'toastily_voter'

/** Read (or mint + set) the anonymous per-device voter token used to enforce
 * one vote per category. Opaque random value in an httpOnly cookie — no login
 * needed, so guests present can vote (PRD §8). */
export function getOrSetVoterToken(event: H3Event): string {
  const existing = getCookie(event, VOTER_COOKIE)
  if (existing) return existing
  const token = randomBytes(32).toString('hex')
  setCookie(event, VOTER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return token
}

/** Read the voter token without minting one (for read-only GET status). */
export function readVoterToken(event: H3Event): string | undefined {
  return getCookie(event, VOTER_COOKIE)
}
