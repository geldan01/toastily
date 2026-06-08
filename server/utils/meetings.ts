import { asc, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../db/client'

/**
 * Re-assign contiguous meeting numbers (PRD §6.1, club choice "auto &
 * contiguous"): non-cancelled meetings get sequential numbers in date order
 * starting from the `meeting.number_start` setting; cancelled meetings are
 * cleared (no number). Idempotent — call after any change that adds, removes,
 * cancels, or un-cancels a meeting.
 */
export async function renumberMeetings() {
  const db = useDrizzle()
  const startRaw = Number(await getSetting('meeting.number_start'))
  const start = Number.isFinite(startRaw) && startRaw > 0 ? Math.floor(startRaw) : 1

  const scheduled = await db.select({ id: schema.meetings.id, number: schema.meetings.meetingNumber })
    .from(schema.meetings)
    .where(eq(schema.meetings.status, 'scheduled'))
    .orderBy(asc(schema.meetings.date))

  for (let i = 0; i < scheduled.length; i++) {
    const want = start + i
    if (scheduled[i]!.number !== want) {
      await db.update(schema.meetings).set({ meetingNumber: want }).where(eq(schema.meetings.id, scheduled[i]!.id))
    }
  }

  // Cancelled meetings carry no number.
  await db.update(schema.meetings).set({ meetingNumber: null }).where(eq(schema.meetings.status, 'cancelled'))
}
