import { and, asc, eq, gte } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * The meeting a guest checking in right now should land on (PRD §9). PUBLIC: the
 * `/checkin` QR target resolves the nearest upcoming non-cancelled meeting
 * (today included) so a static QR always points at "today's" meeting with no
 * per-meeting admin work. Returns only public meeting fields — no member data.
 */
export default defineEventHandler(async () => {
  const db = useDrizzle()
  const today = new Date().toISOString().slice(0, 10)

  const [meeting] = await db.select({
    id: schema.meetings.id,
    date: schema.meetings.date,
    themeEn: schema.meetings.themeEn,
    themeFr: schema.meetings.themeFr,
    location: schema.meetings.location,
  })
    .from(schema.meetings)
    .where(and(gte(schema.meetings.date, today), eq(schema.meetings.status, 'scheduled')))
    .orderBy(asc(schema.meetings.date))
    .limit(1)

  return { meeting: meeting ?? null }
})
