import { and, asc, desc, gte, lte, sql } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function toUtc(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, day!))
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

/**
 * Generate recurring meetings for a span (PRD §6.1, "generate the Toastmaster
 * year"). Steps from `firstDate` to `untilDate` every `everyWeeks` weeks,
 * skipping dates that already have a meeting or a holiday. Optionally sets the
 * `meeting.number_start` setting, then renumbers. Calendar managers only.
 */
export default defineEventHandler(async (event) => {
  const user = await requireCalendarManager(event)
  const body = await readBody(event)

  const firstDate = String(body?.firstDate ?? '').trim()
  const untilDate = String(body?.untilDate ?? '').trim()
  const everyWeeks = Math.min(Math.max(Math.floor(Number(body?.everyWeeks) || 1), 1), 8)
  if (!DATE_RE.test(firstDate) || !DATE_RE.test(untilDate)) {
    throw createError({ statusCode: 400, statusMessage: 'firstDate and untilDate (YYYY-MM-DD) are required.' })
  }
  if (firstDate > untilDate) throw createError({ statusCode: 400, statusMessage: 'firstDate must be on or before untilDate.' })

  const location = body?.location ? String(body.location) : null

  const db = useDrizzle()

  // Optionally update the starting number before renumbering.
  if (body?.numberStart !== undefined && body.numberStart !== '') {
    const n = Math.floor(Number(body.numberStart))
    if (Number.isFinite(n) && n > 0) {
      await db.insert(schema.settings).values({ key: 'meeting.number_start', value: String(n) })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value: String(n), updatedAt: sql`now()` } })
      clearSettingsCache()
    }
  }

  // Candidate dates.
  const dates: string[] = []
  for (let d = toUtc(firstDate); iso(d) <= untilDate; d.setUTCDate(d.getUTCDate() + everyWeeks * 7)) {
    dates.push(iso(d))
  }

  // Existing meetings + holidays in range → skip sets.
  const [existingMeetings, holidays] = await Promise.all([
    db.select({ date: schema.meetings.date }).from(schema.meetings)
      .where(and(gte(schema.meetings.date, firstDate), lte(schema.meetings.date, untilDate))),
    db.select({ date: schema.calendarExceptions.date }).from(schema.calendarExceptions)
      .where(and(gte(schema.calendarExceptions.date, firstDate), lte(schema.calendarExceptions.date, untilDate))),
  ])
  const haveMeeting = new Set(existingMeetings.map(m => m.date))
  const isHoliday = new Set(holidays.map(h => h.date))

  // Default agenda template for the new meetings.
  const [tpl] = await db.select({ id: schema.agendaTemplates.id })
    .from(schema.agendaTemplates)
    .orderBy(desc(schema.agendaTemplates.isDefault), asc(schema.agendaTemplates.createdAt))
    .limit(1)

  let skippedHoliday = 0
  let skippedExisting = 0
  const toCreate: string[] = []
  for (const date of dates) {
    if (isHoliday.has(date)) {
      skippedHoliday++
      continue
    }
    if (haveMeeting.has(date)) {
      skippedExisting++
      continue
    }
    toCreate.push(date)
  }

  if (toCreate.length) {
    await db.insert(schema.meetings).values(toCreate.map(date => ({
      date,
      location,
      templateId: tpl?.id ?? null,
      createdBy: user.id,
    })))
  }

  await renumberMeetings()

  return { created: toCreate.length, skippedHoliday, skippedExisting, candidates: dates.length }
})
