import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Delete an email schedule (officer/admin). PRD §10. */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'officer')
  const id = getRouterParam(event, 'id')!
  await useDrizzle().delete(schema.emailSchedules).where(eq(schema.emailSchedules.id, id))
  return { ok: true }
})
