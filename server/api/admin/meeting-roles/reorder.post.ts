import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Persist a new role ordering (admin): sortOrder = position in `ids`. */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')
  const body = await readBody(event)
  const ids = body?.ids
  if (!Array.isArray(ids) || ids.some(i => typeof i !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'Expected { ids: string[] }' })
  }

  const db = useDrizzle()
  for (let i = 0; i < ids.length; i++) {
    await db.update(schema.meetingRoles).set({ sortOrder: i }).where(eq(schema.meetingRoles.id, ids[i]))
  }
  return { ok: true }
})
