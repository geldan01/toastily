import { asc } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** List email schedules (officer/admin). PRD §10. */
export default defineEventHandler(async (event) => {
  await requireCommunicationManager(event)
  const schedules = await useDrizzle()
    .select()
    .from(schema.emailSchedules)
    .orderBy(asc(schema.emailSchedules.dayOfWeek), asc(schema.emailSchedules.timeOfDay))
  return { schedules }
})
