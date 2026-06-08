import { sql } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Create a meeting role (admin). New roles sort to the end and are active. */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')
  const body = await readBody(event)

  const nameEn = String(body?.nameEn ?? '').trim()
  const nameFr = String(body?.nameFr ?? '').trim()
  if (!nameEn || !nameFr) {
    throw createError({ statusCode: 400, statusMessage: 'Both English and French names are required.' })
  }

  const db = useDrizzle()
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${schema.meetingRoles.sortOrder}), -1) + 1` })
    .from(schema.meetingRoles)

  const [row] = await db.insert(schema.meetingRoles).values({
    nameEn,
    nameFr,
    descriptionEn: body?.descriptionEn ? String(body.descriptionEn) : null,
    descriptionFr: body?.descriptionFr ? String(body.descriptionFr) : null,
    sortOrder: next,
  }).returning()

  return { role: row }
})
