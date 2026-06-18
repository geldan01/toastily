import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** Create an email schedule (officer/admin). PRD §10. */
export default defineEventHandler(async (event) => {
  await requireCommunicationManager(event)
  const body = await readBody(event)

  const templateKey = String(body?.templateKey ?? '').trim()
  const dayOfWeek = Number(body?.dayOfWeek)
  const timeOfDay = String(body?.timeOfDay ?? '').trim()
  const active = body?.active !== false

  if (!templateKey) throw createError({ statusCode: 400, statusMessage: 'A template is required.' })
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw createError({ statusCode: 400, statusMessage: 'Day of week must be 0 (Sunday) through 6.' })
  }
  if (!TIME_RE.test(timeOfDay)) throw createError({ statusCode: 400, statusMessage: 'Time must be HH:MM (24-hour).' })

  const db = useDrizzle()
  const [tmpl] = await db.select({ key: schema.emailTemplates.key })
    .from(schema.emailTemplates).where(eq(schema.emailTemplates.key, templateKey)).limit(1)
  if (!tmpl) throw createError({ statusCode: 400, statusMessage: 'Unknown template.' })

  const [row] = await db.insert(schema.emailSchedules)
    .values({ templateKey, cadence: 'weekly', dayOfWeek, timeOfDay, active })
    .returning()
  return { schedule: row }
})
