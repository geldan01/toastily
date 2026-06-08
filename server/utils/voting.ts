import { randomBytes } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
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

/** The two Table Topics ballots, run together at the end of the session — the
 * manager prepares, opens, and closes both with a single action (PRD §8). */
export const TABLE_TOPICS_CATEGORIES: VoteCategory[] = [
  'best_table_topics_speaker',
  'best_table_topics_evaluator',
]

type DerivedCandidate = { userId: string | null, guestName: string | null }

/** How a derived candidate is labelled on the ballot (PRD §8): the speaker /
 * evaluator awards number their entries in speech order ("Speaker 1", "Evaluator
 * 2"), and any role flagged `countsAsEvaluator` (the Grammarian) is labelled by
 * its role name. Table-topics candidates have no label (just a name). */
export type AwardLabel
  = | { kind: 'speaker', index: number }
    | { kind: 'evaluator', index: number }
    | { kind: 'role', nameEn: string, nameFr: string }

export interface AwardEntry {
  userId: string | null
  guestName: string | null
  name: string | null
  isGuest: boolean
  label: AwardLabel
}

/** Stable identity key for a candidate (member or guest), so we never list the
 * same person twice across speeches/roles. */
function candidateKey(c: { userId: string | null, guestName: string | null }): string {
  return c.userId ? `u:${c.userId}` : `g:${(c.guestName ?? '').toLowerCase()}`
}

/**
 * The ordered, labelled candidate list a speech award is derived from (PRD §8) —
 * the source of truth for *display*. Best Speaker = each speech's presenter in
 * slot order ("Speaker 1", "Speaker 2", …); Best Evaluator = each speech's
 * evaluator ("Evaluator 1", …) **plus** the holders of any role flagged
 * `countsAsEvaluator` (the Grammarian), labelled by role name — data-driven, the
 * role is never matched by name. Only speeches with a participant assigned are
 * included. Table-topics categories return [] (no speech data to derive from).
 */
export async function meetingAwardEntries(
  db: ReturnType<typeof useDrizzle>,
  meetingId: string,
  category: VoteCategory,
): Promise<AwardEntry[]> {
  if (category !== 'best_speaker' && category !== 'best_evaluator') return []
  const isSpeaker = category === 'best_speaker'

  const speeches = await db.select({
    presenterUserId: schema.speeches.presenterUserId,
    presenterGuestName: schema.speeches.presenterGuestName,
    evaluatorUserId: schema.speeches.evaluatorUserId,
    evaluatorGuestName: schema.speeches.evaluatorGuestName,
  })
    .from(schema.speeches)
    .where(eq(schema.speeches.meetingId, meetingId))
    .orderBy(asc(schema.speeches.slot))

  type Raw = { userId: string | null, guestName: string | null, label: AwardLabel }
  const raw: Raw[] = []
  let index = 0
  for (const s of speeches) {
    const userId = isSpeaker ? s.presenterUserId : s.evaluatorUserId
    const guestName = isSpeaker ? s.presenterGuestName : s.evaluatorGuestName
    if (!userId && !guestName) continue
    index += 1
    raw.push({ userId, guestName, label: isSpeaker ? { kind: 'speaker', index } : { kind: 'evaluator', index } })
  }

  // Best Evaluator also includes the Grammarian (any role flagged
  // countsAsEvaluator), skipping anyone already listed as a speech evaluator.
  if (!isSpeaker) {
    const seen = new Set(raw.map(candidateKey))
    const roleHolders = await db.select({
      userId: schema.meetingRoleSignups.userId,
      guestName: schema.meetingRoleSignups.guestName,
      nameEn: schema.meetingRoles.nameEn,
      nameFr: schema.meetingRoles.nameFr,
    })
      .from(schema.meetingRoleSignups)
      .innerJoin(schema.meetingRoles, eq(schema.meetingRoles.id, schema.meetingRoleSignups.roleId))
      .where(and(
        eq(schema.meetingRoleSignups.meetingId, meetingId),
        eq(schema.meetingRoles.countsAsEvaluator, true),
      ))
    for (const h of roleHolders) {
      if (!h.userId && !h.guestName) continue
      const key = candidateKey(h)
      if (seen.has(key)) continue
      seen.add(key)
      raw.push({ userId: h.userId, guestName: h.guestName, label: { kind: 'role', nameEn: h.nameEn, nameFr: h.nameFr } })
    }
  }

  // Resolve member names in a single lookup.
  const userIds = [...new Set(raw.map(r => r.userId).filter((x): x is string => !!x))]
  const userRows = userIds.length
    ? await db.select({ id: schema.users.id, name: schema.users.name })
        .from(schema.users).where(inArray(schema.users.id, userIds))
    : []
  const nameById = new Map(userRows.map(u => [u.id, u.name]))

  return raw.map(r => ({
    userId: r.userId,
    guestName: r.guestName,
    name: r.userId ? (nameById.get(r.userId) ?? null) : r.guestName,
    isGuest: !r.userId,
    label: r.label,
  }))
}

/** The distinct identities a speech award is derived from, for persistence
 * (vote candidates carry no label — labels are computed for display). Dedups the
 * ordered entries by member/guest identity. Table-topics categories return []. */
export async function deriveCandidates(
  db: ReturnType<typeof useDrizzle>,
  meetingId: string,
  category: VoteCategory,
): Promise<DerivedCandidate[]> {
  const entries = await meetingAwardEntries(db, meetingId, category)
  const byKey = new Map<string, DerivedCandidate>()
  for (const e of entries) {
    const key = candidateKey(e)
    if (!byKey.has(key)) byKey.set(key, { userId: e.userId, guestName: e.guestName })
  }
  return [...byKey.values()]
}

/**
 * Merge the meeting's speakers/evaluators into a speech-category ballot,
 * **additively** — it inserts only the derived candidates not already on the
 * ballot (matched on member/guest identity, struck-out ones included, so they're
 * not re-added). Safe to call repeatedly: on prepare and on open/reopen. This
 * keeps Best Speaker / Best Evaluator persisting the actual speakers, evaluators
 * and Grammarian even when the ballot was created before the speeches were
 * assigned, or a participant was added late. No-op for the table-topics
 * categories (no speech data to derive from).
 */
export async function syncDerivedCandidates(
  db: ReturnType<typeof useDrizzle>,
  sessionId: string,
  meetingId: string,
  category: VoteCategory,
): Promise<void> {
  const derived = await deriveCandidates(db, meetingId, category)
  if (!derived.length) return
  const existing = await db.select({
    userId: schema.voteCandidates.userId,
    guestName: schema.voteCandidates.guestName,
  })
    .from(schema.voteCandidates)
    .where(eq(schema.voteCandidates.sessionId, sessionId))
  const present = new Set(existing.map(candidateKey))
  const toAdd = derived.filter(c => !present.has(candidateKey(c)))
  if (toAdd.length) {
    await db.insert(schema.voteCandidates)
      .values(toAdd.map(c => ({ sessionId, userId: c.userId, guestName: c.guestName })))
  }
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
