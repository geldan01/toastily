import { sql } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Create an executive position (admin). Per-group write access defaults off. */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')
  const body = await readBody(event)
  const nameEn = String(body?.nameEn ?? '').trim()
  const nameFr = String(body?.nameFr ?? '').trim()
  if (!nameEn || !nameFr) throw createError({ statusCode: 400, statusMessage: 'Both English and French names are required.' })

  const db = useDrizzle()
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${schema.executivePositions.sortOrder}), -1) + 1` })
    .from(schema.executivePositions)

  const [row] = await db.insert(schema.executivePositions).values({
    nameEn,
    nameFr,
    writePeople: !!body?.writePeople,
    writeMeetings: !!body?.writeMeetings,
    writeContent: !!body?.writeContent,
    writeCommunication: !!body?.writeCommunication,
    writeConfig: !!body?.writeConfig,
    notifyMemberRequests: !!body?.notifyMemberRequests,
    sortOrder: next,
  }).returning()
  return { position: row }
})
