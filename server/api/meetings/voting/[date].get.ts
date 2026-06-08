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

  const resolveName = (c: typeof candRows[number]) => ({
    id: c.id,
    userId: c.userId,
    name: c.userId ? c.userName : c.guestName,
    isGuest: !c.userId,
  })

  const categories = VOTE_CATEGORIES.map((category) => {
    const session = byCategory.get(category) ?? null
    const cands = session ? (candidatesBySession.get(session.id) ?? []) : []
    const showResults = !!session && session.status === 'closed' && canManageVoting
    return {
      category,
      sessionId: session?.id ?? null,
      status: session?.status ?? null,
      candidates: cands.map(resolveName),
      myCandidateId: session ? (myVoteBySession.get(session.id) ?? null) : null,
      hasVoted: session ? myVoteBySession.has(session.id) : false,
      results: showResults
        ? cands
            .map(c => ({ ...resolveName(c), votes: votesByCandidate.get(c.id) ?? 0 }))
            .sort((a, b) => b.votes - a.votes)
        : null,
    }
  })

  return { canManageVoting, categories }
})
