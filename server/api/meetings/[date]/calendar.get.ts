import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'
import { buildIcsCalendar } from '../../../utils/ics'
import { buildMeetingEvents, loadMeetingCalendarConfig, resolveIcsLocale } from '../../../utils/meeting-calendar'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Public iCalendar (.ics) download for a single meeting (issue #59). Anyone
 * viewing the (public) meeting page can add it to their calendar. Cancelled
 * meetings have no calendar entry → 404. Language follows `?lang=en|fr`.
 */
export default defineEventHandler(async (event) => {
  const date = getRouterParam(event, 'date')!
  if (!DATE_RE.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Date must be YYYY-MM-DD.' })
  }

  const [meeting] = await useDrizzle().select({
    id: schema.meetings.id,
    date: schema.meetings.date,
    meetingNumber: schema.meetings.meetingNumber,
    themeEn: schema.meetings.themeEn,
    themeFr: schema.meetings.themeFr,
    location: schema.meetings.location,
    status: schema.meetings.status,
  })
    .from(schema.meetings)
    .where(eq(schema.meetings.date, date))
    .limit(1)

  if (!meeting || meeting.status === 'cancelled') {
    throw createError({ statusCode: 404, statusMessage: 'No meeting on this date.' })
  }

  const locale = resolveIcsLocale(getQuery(event).lang)
  const cfg = await loadMeetingCalendarConfig()
  const events = buildMeetingEvents([meeting], cfg, locale)
  const ics = buildIcsCalendar(events, { calendarName: cfg.clubName })

  setHeader(event, 'content-type', 'text/calendar; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="meeting-${date}.ics"`)
  return ics
})
