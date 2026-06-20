import { and, asc, eq, gte, inArray, or } from 'drizzle-orm'
import type { useDrizzle } from '../db/client'
import { schema } from '../db/client'

/**
 * Member personal dashboard (issue #57) — the forward-looking complement to the
 * history in [participation.ts](./participation.ts). Read-side only: it surfaces
 * the logged-in member's own commitments (roles, speeches as speaker/evaluator)
 * across the next scheduled meetings, so a member opening the site sees "what do
 * *I* have coming up?". Recent activity reuses `memberParticipation`.
 */

/** How many upcoming scheduled meetings the dashboard scans for commitments. */
const UPCOMING_MEETINGS = 5

export interface UpcomingMeetingCommitment {
  meetingId: string
  date: string
  meetingNumber: number | null
  themeEn: string | null
  themeFr: string | null
  /** Roles the member is signed up for at this meeting. */
  roles: { roleNameEn: string, roleNameFr: string }[]
  /** Speeches the member is giving (as speaker), with the timing window. */
  speaking: { slot: number, title: string | null, minMinutes: number | null, maxMinutes: number | null }[]
  /** Speeches the member is evaluating. */
  evaluating: { slot: number, speechTitle: string | null }[]
}

export interface MyCommitments {
  /** The very next scheduled meeting (for quick-action links), or null if none. */
  nextMeeting: { date: string, meetingNumber: number | null } | null
  /** Upcoming meetings where the member has at least one commitment, soonest first. */
  meetings: UpcomingMeetingCommitment[]
}

/**
 * The member's own commitments across the next {@link UPCOMING_MEETINGS}
 * scheduled meetings. Only meetings where the member holds a role, is speaking,
 * or is evaluating appear in `meetings`; `nextMeeting` is always the soonest
 * scheduled meeting regardless of commitment, to anchor the quick actions.
 */
export async function myCommitments(
  db: ReturnType<typeof useDrizzle>,
  userId: string,
  today: string,
): Promise<MyCommitments> {
  const meetings = await db.select({
    id: schema.meetings.id,
    date: schema.meetings.date,
    meetingNumber: schema.meetings.meetingNumber,
    themeEn: schema.meetings.themeEn,
    themeFr: schema.meetings.themeFr,
  })
    .from(schema.meetings)
    .where(and(gte(schema.meetings.date, today), eq(schema.meetings.status, 'scheduled')))
    .orderBy(asc(schema.meetings.date))
    .limit(UPCOMING_MEETINGS)

  if (!meetings.length) return { nextMeeting: null, meetings: [] }

  const meetingIds = meetings.map(m => m.id)

  const roles = await db.select({
    meetingId: schema.meetingRoleSignups.meetingId,
    roleNameEn: schema.meetingRoles.nameEn,
    roleNameFr: schema.meetingRoles.nameFr,
    sortOrder: schema.meetingRoles.sortOrder,
  })
    .from(schema.meetingRoleSignups)
    .innerJoin(schema.meetingRoles, eq(schema.meetingRoles.id, schema.meetingRoleSignups.roleId))
    .where(and(
      inArray(schema.meetingRoleSignups.meetingId, meetingIds),
      eq(schema.meetingRoleSignups.userId, userId),
    ))
    .orderBy(asc(schema.meetingRoles.sortOrder))

  // Speeches where the member is the speaker or the evaluator (one query, split below).
  const speeches = await db.select({
    meetingId: schema.speeches.meetingId,
    slot: schema.speeches.slot,
    title: schema.speeches.title,
    minMinutes: schema.speeches.minMinutes,
    maxMinutes: schema.speeches.maxMinutes,
    presenterUserId: schema.speeches.presenterUserId,
    evaluatorUserId: schema.speeches.evaluatorUserId,
  })
    .from(schema.speeches)
    .where(and(
      inArray(schema.speeches.meetingId, meetingIds),
      or(eq(schema.speeches.presenterUserId, userId), eq(schema.speeches.evaluatorUserId, userId)),
    ))
    .orderBy(asc(schema.speeches.slot))

  const out: UpcomingMeetingCommitment[] = []
  for (const m of meetings) {
    const myRoles = roles.filter(r => r.meetingId === m.id)
      .map(r => ({ roleNameEn: r.roleNameEn, roleNameFr: r.roleNameFr }))
    const speaking = speeches.filter(s => s.meetingId === m.id && s.presenterUserId === userId)
      .map(s => ({ slot: s.slot, title: s.title, minMinutes: s.minMinutes, maxMinutes: s.maxMinutes }))
    const evaluating = speeches.filter(s => s.meetingId === m.id && s.evaluatorUserId === userId)
      .map(s => ({ slot: s.slot, speechTitle: s.title }))
    if (!myRoles.length && !speaking.length && !evaluating.length) continue
    out.push({
      meetingId: m.id,
      date: m.date,
      meetingNumber: m.meetingNumber,
      themeEn: m.themeEn,
      themeFr: m.themeFr,
      roles: myRoles,
      speaking,
      evaluating,
    })
  }

  return {
    nextMeeting: { date: meetings[0]!.date, meetingNumber: meetings[0]!.meetingNumber },
    meetings: out,
  }
}
