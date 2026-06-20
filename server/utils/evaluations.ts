import { and, eq, sql } from 'drizzle-orm'
import type { useDrizzle } from '../db/client'
import { schema } from '../db/client'

/**
 * Written evaluations (issue #60). Eligibility + the pure rating rule, kept here
 * so the API handlers stay thin and the rule is unit-testable without a database.
 */

/** A star rating is a 1–5 integer. Pure so the bound is pinned in one place. */
export function isValidRating(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5
}

/**
 * Whether an attendee may leave a written evaluation at a meeting — i.e. they are
 * *checked in* (issue #60). A member is checked in via `meeting_attendance`; a
 * guest via a `guest_checkins` row matching their name (case-insensitive, the same
 * match used by guest check-in dedup). One of `userId`/`guestName` is supplied.
 */
export async function isCheckedIn(
  db: ReturnType<typeof useDrizzle>,
  meetingId: string,
  who: { userId?: string | null, guestName?: string | null },
): Promise<boolean> {
  if (who.userId) {
    const [row] = await db.select({ id: schema.meetingAttendance.id })
      .from(schema.meetingAttendance)
      .where(and(
        eq(schema.meetingAttendance.meetingId, meetingId),
        eq(schema.meetingAttendance.userId, who.userId),
      ))
      .limit(1)
    return !!row
  }
  const name = (who.guestName ?? '').trim()
  if (!name) return false
  const [row] = await db.select({ id: schema.guestCheckins.id })
    .from(schema.guestCheckins)
    .where(and(
      eq(schema.guestCheckins.meetingId, meetingId),
      sql`lower(${schema.guestCheckins.name}) = ${name.toLowerCase()}`,
    ))
    .limit(1)
  return !!row
}
