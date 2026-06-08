import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** Update an email schedule (officer/admin). Partial — only sent fields change. PRD §10. */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'officer')
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const updates: Partial<typeof schema.emailSchedules.$inferInsert> = {}

  if (body?.templateKey !== undefined) {
    const templateKey = String(body.templateKey).trim()
    const [tmpl] = await useDrizzle().select({ key: schema.emailTemplates.key })
      .from(schema.emailTemplates).where(eq(schema.emailTemplates.key, templateKey)).limit(1)
    if (!tmpl) throw createError({ statusCode: 400, statusMessage: 'Unknown template.' })
    updates.templateKey = templateKey
  }
  if (body?.dayOfWeek !== undefined) {
    const dayOfWeek = Number(body.dayOfWeek)
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw createError({ statusCode: 400, statusMessage: 'Day of week must be 0 (Sunday) through 6.' })
    }
    updates.dayOfWeek = dayOfWeek
  }
  if (body?.timeOfDay !== undefined) {
    const timeOfDay = String(body.timeOfDay).trim()
    if (!TIME_RE.test(timeOfDay)) throw createError({ statusCode: 400, statusMessage: 'Time must be HH:MM (24-hour).' })
    updates.timeOfDay = timeOfDay
  }
  if (body?.active !== undefined) updates.active = Boolean(body.active)

  if (Object.keys(updates).length === 0) return { ok: true }

  const db = useDrizzle()
  const [row] = await db.update(schema.emailSchedules)
    .set(updates).where(eq(schema.emailSchedules.id, id)).returning()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Schedule not found.' })
  return { schedule: row }
})
