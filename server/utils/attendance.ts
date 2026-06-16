import { count, eq } from 'drizzle-orm'
import type { useDrizzle } from '../db/client'
import { schema } from '../db/client'

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
