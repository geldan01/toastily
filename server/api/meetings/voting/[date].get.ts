import { and, count, eq, inArray } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Voting status for a meeting (PRD §8): every award category with its ballot
 * status, candidates, whether THIS device has already voted, and — for meeting
 * managers, once a ballot is closed — the tally. Tallies stay hidden from
 * everyone (managers included) until the ballot closes.
 */
export default defineEventHandler(async (event) => {
  const date = getRouterParam(event, 'date')!
  if (!DATE_RE.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Date must be YYYY-MM-DD.' })
  }
  const db = useDrizzle()

  const [meeting] = await db.select({ id: schema.meetings.id })
    .from(schema.meetings).where(eq(schema.meetings.date, date)).limit(1)
  if (!meeting) {
    return { canManageVoting: false, categories: [] }
  }

  const viewer = await getCurrentUser(event)
  const canManageVoting = await isMeetingManager(viewer, meeting.id)

  const sessions = await db.select()
    .from(schema.voteSessions)
    .where(eq(schema.voteSessions.meetingId, meeting.id))
  const byCategory = new Map(sessions.map(s => [s.category, s]))
  const sessionIds = sessions.map(s => s.id)

  // Candidates (with resolved member/guest name) for every ballot on this meeting.
  const candRows = sessionIds.length
    ? await db.select({
        id: schema.voteCandidates.id,
        sessionId: schema.voteCandidates.sessionId,
        userId: schema.voteCandidates.userId,
        guestName: schema.voteCandidates.guestName,
        excluded: schema.voteCandidates.excluded,
        userName: schema.users.name,
      })
        .from(schema.voteCandidates)
        .leftJoin(schema.users, eq(schema.users.id, schema.voteCandidates.userId))
        .where(inArray(schema.voteCandidates.sessionId, sessionIds))
    : []
  const candidatesBySession = new Map<string, typeof candRows>()
  for (const c of candRows) {
    const list = candidatesBySession.get(c.sessionId) ?? []
    list.push(c)
    candidatesBySession.set(c.sessionId, list)
  }

  // This device's ballots, to show "you voted" state without exposing tallies.
  const token = readVoterToken(event)
  const myBallots = token && sessionIds.length
    ? await db.select({ sessionId: schema.voteBallots.sessionId, candidateId: schema.voteBallots.candidateId })
        .from(schema.voteBallots)
        .where(and(inArray(schema.voteBallots.sessionId, sessionIds), eq(schema.voteBallots.voterToken, token)))
    : []
  const myVoteBySession = new Map(myBallots.map(b => [b.sessionId, b.candidateId]))

  // Tallies only for closed ballots, only for managers (results revealed on close).
  const closedIds = sessions.filter(s => s.status === 'closed').map(s => s.id)
  const tallyRows = canManageVoting && closedIds.length
    ? await db.select({
        sessionId: schema.voteBallots.sessionId,
        candidateId: schema.voteBallots.candidateId,
        votes: count(),
      })
        .from(schema.voteBallots)
        .where(inArray(schema.voteBallots.sessionId, closedIds))
        .groupBy(schema.voteBallots.sessionId, schema.voteBallots.candidateId)
    : []
  const votesByCandidate = new Map(tallyRows.map(r => [r.candidateId, Number(r.votes)]))

  const keyOf = (c: { userId: string | null, guestName: string | null }) =>
    c.userId ? `u:${c.userId}` : `g:${(c.guestName ?? '').toLowerCase()}`

  const categories = []
  for (const category of VOTE_CATEGORIES) {
    const session = byCategory.get(category) ?? null
    const persisted = session ? (candidatesBySession.get(session.id) ?? []) : []
    const persistedByKey = new Map(persisted.map(c => [keyOf(c), c]))

    // Display list = the derived speakers/evaluators (numbered, in speech order,
    // +Grammarian) merged with persisted rows for their id + struck-out state, so
    // speech ballots always show the right people even before a session exists.
    // Table-topics entries are empty here, so its candidates are the persisted
    // (manually-added) rows. Any persisted row not matched by a derived entry
    // (a manual add) is appended without a label.
    const entries = await meetingAwardEntries(db, meeting.id, category)
    const used = new Set<string>()
    const candidates = []
    for (const e of entries) {
      const k = keyOf(e)
      const p = persistedByKey.get(k)
      if (p) used.add(k)
      candidates.push({ id: p?.id ?? null, name: e.name, isGuest: e.isGuest, excluded: p?.excluded ?? false, label: e.label })
    }
    for (const p of persisted) {
      if (used.has(keyOf(p))) continue
      candidates.push({ id: p.id, name: p.userId ? p.userName : p.guestName, isGuest: !p.userId, excluded: p.excluded, label: null })
    }

    // Results revealed to managers once the ballot is closed (PRD §8).
    let results = null
    let tie = false
    if (session && session.status === 'closed' && canManageVoting) {
      results = candidates
        .map(c => ({ ...c, votes: c.id ? (votesByCandidate.get(c.id) ?? 0) : 0 }))
        .sort((a, b) => b.votes - a.votes)
      // Winner(s) = the top vote count among non-excluded candidates (ties allowed).
      const maxVotes = Math.max(0, ...results.filter(r => !r.excluded).map(r => r.votes))
      tie = results.filter(r => !r.excluded && r.votes === maxVotes && maxVotes > 0).length > 1
      results = results.map(r => ({ ...r, isWinner: !r.excluded && r.votes === maxVotes && maxVotes > 0 }))
    }

    categories.push({
      category,
      sessionId: session?.id ?? null,
      status: session?.status ?? null,
      candidates,
      myCandidateId: session ? (myVoteBySession.get(session.id) ?? null) : null,
      hasVoted: session ? myVoteBySession.has(session.id) : false,
      results,
      tie,
    })
  }

  return { canManageVoting, meetingId: meeting.id, categories }
})
