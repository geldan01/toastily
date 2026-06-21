import { and, count, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { useDrizzle } from '../db/client'
import { schema } from '../db/client'
import type { VoteCategory } from '../db/schema/voting'
import { earnedMilestones, type EarnedMilestone } from './milestones'
import { mentorshipFor, type MentorshipLink } from './mentorship'

/**
 * Participation tracking & history (PRD §11). Read-side only — no new schema.
 * Aggregates the records already produced by signups, speeches, voting, and
 * executive/account-role history into a per-person timeline and a club-wide
 * summary. Visible to all members (the API enforces `requireMinRole 'member'`).
 *
 * Only club members (users with a `userId`) are tracked here — guests
 * participate too, but participation history is roster-linked (PRD §11), and
 * guests have no stable identity to thread a timeline through.
 */

/**
 * Winner selection for one ballot (PRD §8, §11) — the member ids that tied for
 * the highest vote count among non-excluded candidates (>0). Pure, so it pins
 * the rule (ties, exclusions, the >0 floor) without a database. Guest candidates
 * have no `userId` and are skipped — participation history is member-only.
 */
export function sessionWinnerUserIds(
  candidates: { id: string, userId: string | null, excluded: boolean }[],
  votesByCandidate: Map<string, number>,
): string[] {
  const eligible = candidates.filter(c => !c.excluded)
  const maxVotes = Math.max(0, ...eligible.map(c => votesByCandidate.get(c.id) ?? 0))
  if (maxVotes <= 0) return []
  return eligible
    .filter(c => c.userId && (votesByCandidate.get(c.id) ?? 0) === maxVotes)
    .map(c => c.userId as string)
}

/** A won award: a member who took the top (non-excluded) vote count, >0, in a
 * closed ballot. Ties yield multiple winners for that category/meeting. */
export interface AwardWin {
  userId: string
  category: VoteCategory
  meetingId: string
  date: string
  votes: number
}

/**
 * Every award win by a member across all *closed* ballots. Winners are a
 * historical fact (who won at a past meeting), so — unlike the live tally, which
 * the voting API hides until close and reveals only to managers — they are shown
 * to all members here. Computed with the same rule as the results view: the
 * highest vote count among non-excluded candidates, >0, ties included.
 */
export async function memberAwardWins(
  db: ReturnType<typeof useDrizzle>,
  userId?: string,
): Promise<AwardWin[]> {
  const closed = await db.select({
    id: schema.voteSessions.id,
    category: schema.voteSessions.category,
    meetingId: schema.voteSessions.meetingId,
    date: schema.meetings.date,
  })
    .from(schema.voteSessions)
    .innerJoin(schema.meetings, eq(schema.meetings.id, schema.voteSessions.meetingId))
    .where(eq(schema.voteSessions.status, 'closed'))
  if (!closed.length) return []

  const sessionIds = closed.map(s => s.id)
  const candidates = await db.select({
    id: schema.voteCandidates.id,
    sessionId: schema.voteCandidates.sessionId,
    userId: schema.voteCandidates.userId,
    excluded: schema.voteCandidates.excluded,
  })
    .from(schema.voteCandidates)
    .where(inArray(schema.voteCandidates.sessionId, sessionIds))

  const tallies = await db.select({
    candidateId: schema.voteBallots.candidateId,
    votes: count(),
  })
    .from(schema.voteBallots)
    .where(inArray(schema.voteBallots.sessionId, sessionIds))
    .groupBy(schema.voteBallots.candidateId)
  const votesByCandidate = new Map(tallies.map(t => [t.candidateId, Number(t.votes)]))

  const candidatesBySession = new Map<string, typeof candidates>()
  for (const c of candidates) {
    const list = candidatesBySession.get(c.sessionId) ?? []
    list.push(c)
    candidatesBySession.set(c.sessionId, list)
  }

  const wins: AwardWin[] = []
  for (const session of closed) {
    const cands = candidatesBySession.get(session.id) ?? []
    const winnerIds = sessionWinnerUserIds(cands, votesByCandidate)
    if (!winnerIds.length) continue
    const maxVotes = Math.max(...cands.filter(c => !c.excluded).map(c => votesByCandidate.get(c.id) ?? 0))
    for (const wid of winnerIds) {
      if (userId && wid !== userId) continue
      wins.push({
        userId: wid,
        category: session.category,
        meetingId: session.meetingId,
        date: session.date,
        votes: maxVotes,
      })
    }
  }
  return wins
}

export interface MeetingAttended { meetingId: string, date: string, meetingNumber: number | null, source: 'self' | 'secretary' }
export interface RoleTaken { meetingId: string, date: string, roleNameEn: string, roleNameFr: string }
export interface SpeechGiven { meetingId: string, date: string, title: string | null, slot: number }
export interface EvaluationDone { meetingId: string, date: string, speechTitle: string | null, slot: number }
/** A written peer evaluation a member *received* on a speech they gave (issue
 * #60). Private — surfaced only to the speaker themselves (and admins). */
export interface EvaluationReceived {
  meetingId: string
  date: string
  speechTitle: string | null
  slot: number
  evaluatorName: string | null
  liked: string | null
  recommend: string | null
  structureRating: number
  vocalVarietyRating: number
  gesturesRating: number
  createdAt: string
}
export interface PositionHeld { positionNameEn: string, positionNameFr: string, startedAt: string, endedAt: string | null }
export interface StatusChange { fromStatus: string | null, toStatus: string, at: string }

export interface MemberParticipation {
  member: {
    id: string
    name: string
    email: string | null
    status: string
    since: string
    bio: string | null
    goals: string | null
    phone: string | null
  }
  attendance: MeetingAttended[]
  roles: RoleTaken[]
  speeches: SpeechGiven[]
  evaluations: EvaluationDone[]
  evaluationsReceived: EvaluationReceived[]
  awards: (AwardWin & { meetingNumber: number | null })[]
  positions: PositionHeld[]
  statusHistory: StatusChange[]
  /** Current mentor (if any) and current mentees (issue #62). Shown on both
   * members' pages — the pairing carries no privacy gate. */
  mentor: MentorshipLink | null
  mentees: MentorshipLink[]
  /** Achievement badges earned from this member's participation (issue #64).
   * Computed on the fly from the counts above; public (no privacy gate). */
  milestones: EarnedMilestone[]
}

/** Full participation timeline for one member, newest first within each
 * category. Returns null when the id is not a member/officer/admin.
 *
 * `includeReceivedEvaluations` gates the written peer evaluations the member
 * received (issue #60) — candid feedback meant only for the speaker, so the API
 * passes `true` only when the requester is that member (or an admin); otherwise
 * the array is empty. */
export async function memberParticipation(
  db: ReturnType<typeof useDrizzle>,
  userId: string,
  opts: { includeReceivedEvaluations?: boolean, includeContact?: boolean } = {},
): Promise<MemberParticipation | null> {
  const [member] = await db.select({
    id: schema.users.id,
    name: schema.users.name,
    email: schema.users.email,
    status: schema.users.status,
    since: schema.users.createdAt,
    bio: schema.users.bio,
    goals: schema.users.goals,
    phone: schema.users.phone,
    showContactInfo: schema.users.showContactInfo,
  })
    .from(schema.users)
    .where(and(
      eq(schema.users.id, userId),
      inArray(schema.users.status, ['member', 'officer', 'admin']),
    ))
    .limit(1)
  if (!member) return null

  // Meetings the member was marked present at (issue #35), newest first. Distinct
  // from roles/speeches — a member may simply have attended.
  const attendance = await db.select({
    meetingId: schema.meetingAttendance.meetingId,
    date: schema.meetings.date,
    meetingNumber: schema.meetings.meetingNumber,
    source: schema.meetingAttendance.source,
  })
    .from(schema.meetingAttendance)
    .innerJoin(schema.meetings, eq(schema.meetings.id, schema.meetingAttendance.meetingId))
    .where(eq(schema.meetingAttendance.userId, userId))
    .orderBy(desc(schema.meetings.date))

  // Role signups carry the role id + authority flag too, used only to derive
  // role-variety / "chaired a meeting" milestones (issue #64); the client-facing
  // `roles` array keeps just the four display fields.
  const roleRows = await db.select({
    meetingId: schema.meetingRoleSignups.meetingId,
    date: schema.meetings.date,
    roleId: schema.meetingRoles.id,
    grantsMeetingAuthority: schema.meetingRoles.grantsMeetingAuthority,
    roleNameEn: schema.meetingRoles.nameEn,
    roleNameFr: schema.meetingRoles.nameFr,
  })
    .from(schema.meetingRoleSignups)
    .innerJoin(schema.meetings, eq(schema.meetings.id, schema.meetingRoleSignups.meetingId))
    .innerJoin(schema.meetingRoles, eq(schema.meetingRoles.id, schema.meetingRoleSignups.roleId))
    .where(eq(schema.meetingRoleSignups.userId, userId))
    .orderBy(desc(schema.meetings.date))
  const roles: RoleTaken[] = roleRows.map(r => ({
    meetingId: r.meetingId,
    date: r.date,
    roleNameEn: r.roleNameEn,
    roleNameFr: r.roleNameFr,
  }))

  const speeches = await db.select({
    meetingId: schema.speeches.meetingId,
    date: schema.meetings.date,
    title: schema.speeches.title,
    slot: schema.speeches.slot,
  })
    .from(schema.speeches)
    .innerJoin(schema.meetings, eq(schema.meetings.id, schema.speeches.meetingId))
    .where(eq(schema.speeches.presenterUserId, userId))
    .orderBy(desc(schema.meetings.date))

  const evaluations = await db.select({
    meetingId: schema.speeches.meetingId,
    date: schema.meetings.date,
    speechTitle: schema.speeches.title,
    slot: schema.speeches.slot,
  })
    .from(schema.speeches)
    .innerJoin(schema.meetings, eq(schema.meetings.id, schema.speeches.meetingId))
    .where(eq(schema.speeches.evaluatorUserId, userId))
    .orderBy(desc(schema.meetings.date))

  // Written peer evaluations received on this member's speeches (issue #60),
  // newest first. Only computed when authorized — it's private to the speaker.
  const evaluator = alias(schema.users, 'evaluator')
  const evaluationsReceived = opts.includeReceivedEvaluations
    ? (await db.select({
        meetingId: schema.writtenEvaluations.meetingId,
        date: schema.meetings.date,
        speechTitle: schema.speeches.title,
        slot: schema.speeches.slot,
        evaluatorUserName: evaluator.name,
        evaluatorGuestName: schema.writtenEvaluations.evaluatorGuestName,
        liked: schema.writtenEvaluations.liked,
        recommend: schema.writtenEvaluations.recommend,
        structureRating: schema.writtenEvaluations.structureRating,
        vocalVarietyRating: schema.writtenEvaluations.vocalVarietyRating,
        gesturesRating: schema.writtenEvaluations.gesturesRating,
        createdAt: schema.writtenEvaluations.createdAt,
      })
        .from(schema.writtenEvaluations)
        .innerJoin(schema.speeches, eq(schema.speeches.id, schema.writtenEvaluations.speechId))
        .innerJoin(schema.meetings, eq(schema.meetings.id, schema.writtenEvaluations.meetingId))
        .leftJoin(evaluator, eq(evaluator.id, schema.writtenEvaluations.evaluatorUserId))
        .where(eq(schema.speeches.presenterUserId, userId))
        .orderBy(desc(schema.meetings.date)))
        .map(e => ({
          meetingId: e.meetingId,
          date: e.date,
          speechTitle: e.speechTitle,
          slot: e.slot,
          evaluatorName: e.evaluatorUserName ?? e.evaluatorGuestName,
          liked: e.liked,
          recommend: e.recommend,
          structureRating: e.structureRating,
          vocalVarietyRating: e.vocalVarietyRating,
          gesturesRating: e.gesturesRating,
          createdAt: e.createdAt as unknown as string,
        }))
    : []

  const positions = await db.select({
    positionNameEn: schema.executivePositions.nameEn,
    positionNameFr: schema.executivePositions.nameFr,
    startedAt: schema.executiveAssignments.startedAt,
    endedAt: schema.executiveAssignments.endedAt,
  })
    .from(schema.executiveAssignments)
    .innerJoin(schema.executivePositions, eq(schema.executivePositions.id, schema.executiveAssignments.positionId))
    .where(eq(schema.executiveAssignments.userId, userId))
    .orderBy(desc(schema.executiveAssignments.startedAt))

  const statusHistory = await db.select({
    fromStatus: schema.roleHistory.fromStatus,
    toStatus: schema.roleHistory.toStatus,
    at: schema.roleHistory.createdAt,
  })
    .from(schema.roleHistory)
    .where(eq(schema.roleHistory.userId, userId))
    .orderBy(desc(schema.roleHistory.createdAt))

  // Award wins, enriched with the meeting number for display.
  const wins = await memberAwardWins(db, userId)
  const meetingIds = [...new Set(wins.map(w => w.meetingId))]
  const numbers = meetingIds.length
    ? await db.select({ id: schema.meetings.id, meetingNumber: schema.meetings.meetingNumber })
        .from(schema.meetings).where(inArray(schema.meetings.id, meetingIds))
    : []
  const numberById = new Map(numbers.map(m => [m.id, m.meetingNumber]))
  const awards = wins
    .map(w => ({ ...w, meetingNumber: numberById.get(w.meetingId) ?? null }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  // Current mentor / mentees (issue #62) — shown on both members' pages.
  const { mentor, mentees } = await mentorshipFor(db, userId)

  // Achievement badges (issue #64) — reduce the timeline to counts and run the
  // data-driven catalog. distinctRoles / chaired come from the role flags.
  const milestones = earnedMilestones({
    attended: attendance.length,
    speeches: speeches.length,
    evaluations: evaluations.length,
    roles: roleRows.length,
    distinctRoles: new Set(roleRows.map(r => r.roleId)).size,
    chaired: roleRows.filter(r => r.grantsMeetingAuthority).length,
    awards: awards.length,
  })

  // Contact-visibility preference (issue #61): hide email/phone from other
  // members unless this member opted in (or the requester is the member/admin,
  // signalled by includeContact). bio/goals are directory content, always shown.
  const { showContactInfo, ...memberFields } = member
  const canSeeContact = showContactInfo || opts.includeContact === true

  return {
    member: {
      ...memberFields,
      since: member.since as unknown as string,
      email: canSeeContact ? member.email : null,
      phone: canSeeContact ? (member.phone ?? null) : null,
    },
    attendance,
    roles,
    speeches,
    evaluations,
    evaluationsReceived,
    awards,
    positions: positions.map(p => ({
      ...p,
      startedAt: p.startedAt as unknown as string,
      endedAt: p.endedAt as unknown as string | null,
    })),
    statusHistory: statusHistory.map(s => ({ ...s, at: s.at as unknown as string })),
    mentor,
    mentees,
    milestones,
  }
}

export interface ParticipationSummaryRow {
  id: string
  name: string
  status: string
  positions: { nameEn: string, nameFr: string }[]
  attended: number
  roles: number
  speeches: number
  evaluations: number
  awards: number
}

/**
 * Club-wide participation counts, one row per member (roster-linked, PRD §11).
 * Each count is a single grouped query; award wins are tallied from the closed
 * ballots. Members with no participation still appear (zeroed).
 */
export async function participationSummary(
  db: ReturnType<typeof useDrizzle>,
): Promise<ParticipationSummaryRow[]> {
  const members = await db.select({
    id: schema.users.id,
    name: schema.users.name,
    status: schema.users.status,
  })
    .from(schema.users)
    .where(inArray(schema.users.status, ['member', 'officer', 'admin']))
    .orderBy(schema.users.name)

  const attendedCounts = await db.select({
    userId: schema.meetingAttendance.userId,
    n: count(),
  })
    .from(schema.meetingAttendance)
    .groupBy(schema.meetingAttendance.userId)

  const roleCounts = await db.select({
    userId: schema.meetingRoleSignups.userId,
    n: count(),
  })
    .from(schema.meetingRoleSignups)
    .where(isNotNull(schema.meetingRoleSignups.userId))
    .groupBy(schema.meetingRoleSignups.userId)

  const speechCounts = await db.select({
    userId: schema.speeches.presenterUserId,
    n: count(),
  })
    .from(schema.speeches)
    .where(isNotNull(schema.speeches.presenterUserId))
    .groupBy(schema.speeches.presenterUserId)

  const evalCounts = await db.select({
    userId: schema.speeches.evaluatorUserId,
    n: count(),
  })
    .from(schema.speeches)
    .where(isNotNull(schema.speeches.evaluatorUserId))
    .groupBy(schema.speeches.evaluatorUserId)

  // Current executive positions, like the roster, so officers show their roles.
  const assignments = await db.select({
    userId: schema.executiveAssignments.userId,
    nameEn: schema.executivePositions.nameEn,
    nameFr: schema.executivePositions.nameFr,
    sortOrder: schema.executivePositions.sortOrder,
  })
    .from(schema.executiveAssignments)
    .innerJoin(schema.executivePositions, eq(schema.executivePositions.id, schema.executiveAssignments.positionId))
    .where(and(
      isNull(schema.executiveAssignments.endedAt),
      eq(schema.executivePositions.active, true),
    ))
    .orderBy(schema.executivePositions.sortOrder)

  const wins = await memberAwardWins(db)

  const attendedByUser = new Map(attendedCounts.map(r => [r.userId, Number(r.n)]))
  const rolesByUser = new Map(roleCounts.map(r => [r.userId!, Number(r.n)]))
  const speechesByUser = new Map(speechCounts.map(r => [r.userId!, Number(r.n)]))
  const evalsByUser = new Map(evalCounts.map(r => [r.userId!, Number(r.n)]))
  const awardsByUser = new Map<string, number>()
  for (const w of wins) awardsByUser.set(w.userId, (awardsByUser.get(w.userId) ?? 0) + 1)
  const positionsByUser = new Map<string, { nameEn: string, nameFr: string }[]>()
  for (const a of assignments) {
    const list = positionsByUser.get(a.userId) ?? []
    list.push({ nameEn: a.nameEn, nameFr: a.nameFr })
    positionsByUser.set(a.userId, list)
  }

  return members.map(m => ({
    id: m.id,
    name: m.name,
    status: m.status,
    positions: positionsByUser.get(m.id) ?? [],
    attended: attendedByUser.get(m.id) ?? 0,
    roles: rolesByUser.get(m.id) ?? 0,
    speeches: speechesByUser.get(m.id) ?? 0,
    evaluations: evalsByUser.get(m.id) ?? 0,
    awards: awardsByUser.get(m.id) ?? 0,
  }))
}
