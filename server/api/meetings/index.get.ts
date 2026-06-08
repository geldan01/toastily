import { asc, desc } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/** Public calendar (PRD §6.1): all meetings (newest first) + holiday exceptions. */
export default defineEventHandler(async () => {
  const db = useDrizzle()
  const meetings = await db.select({
    id: schema.meetings.id,
    date: schema.meetings.date,
    meetingNumber: schema.meetings.meetingNumber,
    status: schema.meetings.status,
    themeEn: schema.meetings.themeEn,
    themeFr: schema.meetings.themeFr,
    location: schema.meetings.location,
  })
    .from(schema.meetings)
    .orderBy(desc(schema.meetings.date))

  const holidays = await db.select({
    id: schema.calendarExceptions.id,
    date: schema.calendarExceptions.date,
    labelEn: schema.calendarExceptions.labelEn,
    labelFr: schema.calendarExceptions.labelFr,
  })
    .from(schema.calendarExceptions)
    .orderBy(asc(schema.calendarExceptions.date))

  return { meetings, holidays }
})
