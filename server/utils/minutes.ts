import type { H3Event } from 'h3'
import { and, count, desc, eq, lt } from 'drizzle-orm'
import { schema, useDrizzle } from '../db/client'
import type { User } from '../db/schema'

/**
 * Whether `user` is the minutes secretary of a given meeting (PRD §6, issue
 * #14): the member signed up on that meeting for a role flagged
 * `isMinutesSecretary`. Authority is data, never a hard-coded "Secretary" name —
 * a club decides which role confers it, resolved per meeting from the signups.
 */
export async function isMinutesSecretary(user: User | null | undefined, meetingId: string): Promise<boolean> {
  if (!user) return false
  const [row] = await useDrizzle()
    .select({ id: schema.meetingRoleSignups.id })
    .from(schema.meetingRoleSignups)
    .innerJoin(schema.meetingRoles, eq(schema.meetingRoles.id, schema.meetingRoleSignups.roleId))
    .where(and(
      eq(schema.meetingRoleSignups.meetingId, meetingId),
      eq(schema.meetingRoleSignups.userId, user.id),
      eq(schema.meetingRoles.isMinutesSecretary, true),
    ))
    .limit(1)
  return !!row
}

/**
 * Whether `user` may author/approve a given meeting's minutes (PRD §6, issue
 * #14). True for:
 *  - admin (always);
 *  - a holder of a `canManageMinutes` executive position (the President);
 *  - the meeting's minutes secretary (per-meeting, via the role flag).
 * All three are data-driven — no position or role name is hard-coded.
 */
export async function canManageMeetingMinutes(user: User | null | undefined, meetingId: string): Promise<boolean> {
  if (!user) return false
  if (user.status === 'admin') return true
  const caps = await effectiveCapabilities(user)
  if (caps.canManageMinutes) return true
  return await isMinutesSecretary(user, meetingId)
}

type Db = ReturnType<typeof useDrizzle>

export interface QuorumHistoryEntry { date: string, meetingNumber: number | null, membersPresent: number }

/**
 * The quorum threshold for a meeting on `beforeDate` (PRD §6, issue #14):
 * the MAJORITY OF THE AVERAGE members present over the previous 3 meetings that
 * have recorded attendance — `threshold = floor(avg / 2) + 1`, avg = sum/N over
 * the up-to-3 meetings actually used. "Members present" is the count of member
 * check-ins (meeting_attendance rows); guests never count. Looks back past
 * meetings with no recorded attendance (and cancelled ones) until it finds up to
 * 3 with data. Returns a null threshold when there is no prior data to base it
 * on. Rounding: the average is kept exact and floored only at the end.
 */
export async function quorumThreshold(db: Db, beforeDate: string): Promise<{ threshold: number | null, history: QuorumHistoryEntry[] }> {
  const prev = await db
    .select({ id: schema.meetings.id, date: schema.meetings.date, meetingNumber: schema.meetings.meetingNumber })
    .from(schema.meetings)
    .where(and(eq(schema.meetings.status, 'scheduled'), lt(schema.meetings.date, beforeDate)))
    .orderBy(desc(schema.meetings.date))

  const history: QuorumHistoryEntry[] = []
  for (const m of prev) {
    if (history.length >= 3) break
    const [c] = await db
      .select({ n: count() })
      .from(schema.meetingAttendance)
      .where(eq(schema.meetingAttendance.meetingId, m.id))
    const present = Number(c?.n ?? 0)
    if (present > 0) history.push({ date: m.date, meetingNumber: m.meetingNumber, membersPresent: present })
  }
  if (history.length === 0) return { threshold: null, history: [] }
  const avg = history.reduce((s, h) => s + h.membersPresent, 0) / history.length
  return { threshold: Math.floor(avg / 2) + 1, history }
}

/**
 * The quorum picture for a single meeting: the computed threshold + the history
 * it was based on, the current present counts (members from check-ins, plus
 * guests/total for context), and whether quorum is met (members present ≥
 * threshold). Present counts are always derived from check-ins — the secretary
 * records them on the roster, anytime (even after the meeting).
 */
export interface MeetingQuorum {
  members: number
  guests: number
  total: number
  threshold: number | null
  history: QuorumHistoryEntry[]
  met: boolean
}

export async function meetingQuorum(db: Db, meetingId: string, meetingDate: string): Promise<MeetingQuorum> {
  const present = await meetingPresentCount(db, meetingId)
  const { threshold, history } = await quorumThreshold(db, meetingDate)
  return {
    members: present.members,
    guests: present.guests,
    total: present.total,
    threshold,
    history,
    met: threshold != null && present.members >= threshold,
  }
}

/**
 * Route guard: require the current user to be able to manage `meetingId`'s
 * minutes, mirroring requireCalendarManager. Returns the authenticated user.
 */
export async function requireMinutesManager(event: H3Event, meetingId: string): Promise<User> {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  if (!(await canManageMeetingMinutes(user, meetingId))) {
    throw createError({ statusCode: 403, statusMessage: 'Minutes-management permission required' })
  }
  return user
}
