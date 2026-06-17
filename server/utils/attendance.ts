import { count, eq } from 'drizzle-orm'
import type { useDrizzle } from '../db/client'
import { schema } from '../db/client'
import type { User } from '../db/schema'

/**
 * Present count for a meeting (issue #35, quorum aid, PRD §9/§11). The total is
 * members marked present (`meeting_attendance`) plus checked-in guests
 * (`guest_checkins`) — both count toward who is in the room for quorum.
 */
export interface PresentCount {
  members: number
  guests: number
  total: number
}

export async function meetingPresentCount(
  db: ReturnType<typeof useDrizzle>,
  meetingId: string,
): Promise<PresentCount> {
  const [members] = await db.select({ n: count() })
    .from(schema.meetingAttendance)
    .where(eq(schema.meetingAttendance.meetingId, meetingId))
  const [guests] = await db.select({ n: count() })
    .from(schema.guestCheckins)
    .where(eq(schema.guestCheckins.meetingId, meetingId))
  const m = Number(members?.n ?? 0)
  const g = Number(guests?.n ?? 0)
  return { members: m, guests: g, total: m + g }
}

/**
 * Whether `user` may record attendance (check members in/out) for a meeting.
 * Either a meeting manager (officer/admin or an authority-granting role holder,
 * e.g. the Toastmaster) OR the meeting's minutes secretary — recording who is
 * present is part of the secretary's job (the present count feeds quorum and the
 * minutes). Data-driven via flags, never a hard-coded role/position name.
 */
export async function canRecordAttendance(user: User | null | undefined, meetingId: string): Promise<boolean> {
  if (!user) return false
  if (await isMeetingManager(user, meetingId)) return true
  return await canManageMeetingMinutes(user, meetingId)
}
