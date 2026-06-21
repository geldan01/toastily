import { and, eq, gte, or } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'
import { buildIcsCalendar } from '../../utils/ics'
import { buildMeetingEvents, loadMeetingCalendarConfig, resolveIcsLocale, type CalendarMeetingRow } from '../../utils/meeting-calendar'

/**
 * Personalised iCalendar (.ics) feed of the member's upcoming commitments
 * (issue #59): every scheduled meeting, today onward, where they hold a role
 * signup or are a speech speaker/evaluator. Member-gated. Language follows
 * `?lang=en|fr`, defaulting to the member's stored locale.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const db = useDrizzle()
  const today = new Date().toISOString().slice(0, 10)

  const cols = {
    id: schema.meetings.id,
    date: schema.meetings.date,
    meetingNumber: schema.meetings.meetingNumber,
    themeEn: schema.meetings.themeEn,
    themeFr: schema.meetings.themeFr,
    location: schema.meetings.location,
  }
  const upcoming = and(eq(schema.meetings.status, 'scheduled'), gte(schema.meetings.date, today))

  const roleMeetings = await db.select(cols)
    .from(schema.meetingRoleSignups)
    .innerJoin(schema.meetings, eq(schema.meetings.id, schema.meetingRoleSignups.meetingId))
    .where(and(eq(schema.meetingRoleSignups.userId, user.id), upcoming))

  const speechMeetings = await db.select(cols)
    .from(schema.speeches)
    .innerJoin(schema.meetings, eq(schema.meetings.id, schema.speeches.meetingId))
    .where(and(
      or(eq(schema.speeches.presenterUserId, user.id), eq(schema.speeches.evaluatorUserId, user.id)),
      upcoming,
    ))

  // Dedupe (a member may have both a role and a speech on the same meeting).
  const byId = new Map<string, CalendarMeetingRow>()
  for (const m of [...roleMeetings, ...speechMeetings]) byId.set(m.id, m)
  const meetings = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date))

  const locale = resolveIcsLocale(getQuery(event).lang, user.locale === 'fr' ? 'fr' : 'en')
  const cfg = await loadMeetingCalendarConfig()
  const events = buildMeetingEvents(meetings, cfg, locale)
  const ics = buildIcsCalendar(events, { calendarName: `${cfg.clubName} — ${user.name}` })

  setHeader(event, 'content-type', 'text/calendar; charset=utf-8')
  setHeader(event, 'content-disposition', 'attachment; filename="my-meetings.ics"')
  return ics
})
