import { and, eq, sql } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Guest check-in for a meeting (PRD §9). PUBLIC: a guest who scanned the meeting
 * QR adds their own name (+ optional email) with no account; a logged-in member
 * may also add a guest on the spot (recorded as `addedBy`). Soft-deduped by
 * meeting + case-insensitive name so a double tap / re-scan doesn't pile up
 * duplicates — an existing match is returned unchanged.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const meetingId = String(body?.meetingId ?? '')
  const name = String(body?.name ?? '').trim()
  const email = body?.email != null ? String(body.email).trim() : ''
  if (!meetingId || !name) throw createError({ statusCode: 400, statusMessage: 'meetingId and name are required.' })
  if (email && !EMAIL_RE.test(email)) throw createError({ statusCode: 400, statusMessage: 'Email looks invalid.' })

  const db = useDrizzle()
  const [meeting] = await db.select({ id: schema.meetings.id })
    .from(schema.meetings).where(eq(schema.meetings.id, meetingId)).limit(1)
  if (!meeting) throw createError({ statusCode: 404, statusMessage: 'Meeting not found.' })

  // A logged-in member adding the guest is recorded; an anonymous self check-in
  // leaves addedBy null. No role gate — anyone with the QR can check a guest in.
  const user = await getCurrentUser(event)

  const [dupe] = await db.select()
    .from(schema.guestCheckins)
    .where(and(
      eq(schema.guestCheckins.meetingId, meetingId),
      sql`lower(${schema.guestCheckins.name}) = ${name.toLowerCase()}`,
    ))
    .limit(1)
  if (dupe) return { checkin: dupe, deduped: true }

  const [row] = await db.insert(schema.guestCheckins)
    .values({ meetingId, name, email: email || null, addedBy: user?.id ?? null })
    .returning()
  return { checkin: row, deduped: false }
})
