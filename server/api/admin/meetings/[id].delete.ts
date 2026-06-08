import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Delete a meeting (calendar managers). Cascades to its signups and speeches. */
export default defineEventHandler(async (event) => {
  await requireCalendarManager(event)
  const id = getRouterParam(event, 'id')!
  const [row] = await useDrizzle().delete(schema.meetings).where(eq(schema.meetings.id, id)).returning({ id: schema.meetings.id })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Meeting not found.' })
  await renumberMeetings()
  return { ok: true }
})
