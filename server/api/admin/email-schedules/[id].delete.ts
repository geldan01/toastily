import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Delete an email schedule. Signup-reminder schedule: communication OR calendar
 * managers; any other template: communication only. PRD §10 / issue #59. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const db = useDrizzle()

  const [existing] = await db.select({ templateKey: schema.emailSchedules.templateKey })
    .from(schema.emailSchedules).where(eq(schema.emailSchedules.id, id)).limit(1)
  if (!existing) return { ok: true }

  await requireScheduleManager(event, existing.templateKey)
  await db.delete(schema.emailSchedules).where(eq(schema.emailSchedules.id, id))
  return { ok: true }
})
