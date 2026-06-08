import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Remove a holiday / no-meeting exception (calendar managers). */
export default defineEventHandler(async (event) => {
  await requireCalendarManager(event)
  const id = getRouterParam(event, 'id')!
  const [row] = await useDrizzle().delete(schema.calendarExceptions).where(eq(schema.calendarExceptions.id, id)).returning({ id: schema.calendarExceptions.id })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Holiday not found.' })
  return { ok: true }
})
