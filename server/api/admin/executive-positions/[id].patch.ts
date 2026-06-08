import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Update an executive position's names, capability flags, or active state (admin). */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const patch: Record<string, unknown> = {}
  if (body?.nameEn !== undefined) {
    const v = String(body.nameEn).trim()
    if (!v) throw createError({ statusCode: 400, statusMessage: 'English name cannot be empty.' })
    patch.nameEn = v
  }
  if (body?.nameFr !== undefined) {
    const v = String(body.nameFr).trim()
    if (!v) throw createError({ statusCode: 400, statusMessage: 'French name cannot be empty.' })
    patch.nameFr = v
  }
  for (const f of ['canManageCalendar', 'canManageContent', 'canAssignOfficers', 'active'] as const) {
    if (body?.[f] !== undefined) patch[f] = Boolean(body[f])
  }
  if (Object.keys(patch).length === 0) throw createError({ statusCode: 400, statusMessage: 'No fields to update.' })

  const [row] = await useDrizzle().update(schema.executivePositions).set(patch).where(eq(schema.executivePositions.id, id)).returning()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Position not found.' })
  return { position: row }
})
