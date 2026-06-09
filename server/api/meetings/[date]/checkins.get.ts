import { asc, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Checked-in guests for a meeting (PRD §9). Member-gated: any member can view the
 * current meeting's guests (the Chair welcomes them, the Table Topics Master may
 * invite them up). Anonymous self check-in does not read this list back. The list
 * doubles as a pick source for assigning roles/speeches/vote candidates.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'member')
  const date = getRouterParam(event, 'date')!
  if (!DATE_RE.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Date must be YYYY-MM-DD.' })
  }

  const db = useDrizzle()
  const [meeting] = await db.select({ id: schema.meetings.id })
    .from(schema.meetings).where(eq(schema.meetings.date, date)).limit(1)
  if (!meeting) return { guests: [] }

  const guests = await db.select({
    id: schema.guestCheckins.id,
    name: schema.guestCheckins.name,
    email: schema.guestCheckins.email,
    createdAt: schema.guestCheckins.createdAt,
  })
    .from(schema.guestCheckins)
    .where(eq(schema.guestCheckins.meetingId, meeting.id))
    .orderBy(asc(schema.guestCheckins.createdAt))

  return { guests }
})
