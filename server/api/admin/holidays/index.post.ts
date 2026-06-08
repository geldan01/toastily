import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Add a holiday / no-meeting exception (calendar managers, PRD §6.1). */
export default defineEventHandler(async (event) => {
  const user = await requireCalendarManager(event)
  const body = await readBody(event)

  const date = String(body?.date ?? '').trim()
  const labelEn = String(body?.labelEn ?? '').trim()
  const labelFr = String(body?.labelFr ?? '').trim()
  if (!DATE_RE.test(date)) throw createError({ statusCode: 400, statusMessage: 'A valid date (YYYY-MM-DD) is required.' })
  if (!labelEn || !labelFr) throw createError({ statusCode: 400, statusMessage: 'Both English and French labels are required.' })

  const db = useDrizzle()
  const [existing] = await db.select({ id: schema.calendarExceptions.id }).from(schema.calendarExceptions).where(eq(schema.calendarExceptions.date, date)).limit(1)
  if (existing) throw createError({ statusCode: 409, statusMessage: 'A holiday already exists on that date.' })

  const [row] = await db.insert(schema.calendarExceptions).values({ date, labelEn, labelFr, createdBy: user.id }).returning()

  // A holiday means no meeting that day: remove any meeting already scheduled on
  // this date (PRD §6.1). These are upcoming meetings (no minutes yet).
  const removed = await db.delete(schema.meetings).where(eq(schema.meetings.date, date)).returning({ id: schema.meetings.id })
  if (removed.length) await renumberMeetings()

  return { holiday: row, removedMeeting: removed.length > 0 }
})
