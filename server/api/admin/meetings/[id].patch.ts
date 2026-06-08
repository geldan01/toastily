import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Update a meeting's theme/location/notes/template (calendar managers). */
export default defineEventHandler(async (event) => {
  await requireCalendarManager(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const patch: Record<string, unknown> = {}
  for (const f of ['themeEn', 'themeFr', 'location', 'notesEn', 'notesFr', 'minutesEn', 'minutesFr'] as const) {
    if (body?.[f] !== undefined) patch[f] = body[f] ? String(body[f]) : null
  }
  if (body?.templateId !== undefined) patch.templateId = body.templateId || null

  // Manual cancel / un-cancel (PRD §6.1). Cancelled meetings keep their row but
  // drop out of contiguous numbering — so renumber afterwards.
  let statusChanged = false
  if (body?.status !== undefined) {
    if (body.status !== 'scheduled' && body.status !== 'cancelled') {
      throw createError({ statusCode: 400, statusMessage: 'status must be scheduled or cancelled.' })
    }
    patch.status = body.status
    statusChanged = true
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update.' })
  }

  const [row] = await useDrizzle().update(schema.meetings).set(patch).where(eq(schema.meetings.id, id)).returning()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Meeting not found.' })
  if (statusChanged) await renumberMeetings()
  return { meeting: row }
})
