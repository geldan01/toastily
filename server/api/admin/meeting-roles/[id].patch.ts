import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Update a meeting role's bilingual name/description or active flag (admin). */
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
  if (body?.descriptionEn !== undefined) patch.descriptionEn = body.descriptionEn ? String(body.descriptionEn) : null
  if (body?.descriptionFr !== undefined) patch.descriptionFr = body.descriptionFr ? String(body.descriptionFr) : null
  if (body?.active !== undefined) patch.active = Boolean(body.active)
  if (body?.grantsMeetingAuthority !== undefined) patch.grantsMeetingAuthority = Boolean(body.grantsMeetingAuthority)
  if (body?.isMeetingOfficer !== undefined) patch.isMeetingOfficer = Boolean(body.isMeetingOfficer)

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update.' })
  }

  const [row] = await useDrizzle()
    .update(schema.meetingRoles)
    .set(patch)
    .where(eq(schema.meetingRoles.id, id))
    .returning()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Role not found.' })
  return { role: row }
})
