import { asc, desc, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Create a meeting (calendar managers, PRD §6.1). Defaults to the default
 * agenda template when none is given. One meeting per date (unique).
 */
export default defineEventHandler(async (event) => {
  const user = await requireCalendarManager(event)
  const body = await readBody(event)

  const date = String(body?.date ?? '').trim()
  if (!DATE_RE.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid date (YYYY-MM-DD) is required.' })
  }

  const db = useDrizzle()
  const [existing] = await db.select({ id: schema.meetings.id }).from(schema.meetings).where(eq(schema.meetings.date, date)).limit(1)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'A meeting already exists on that date.' })
  }

  let templateId: string | null = body?.templateId ?? null
  if (!templateId) {
    const [tpl] = await db.select({ id: schema.agendaTemplates.id })
      .from(schema.agendaTemplates)
      .orderBy(desc(schema.agendaTemplates.isDefault), asc(schema.agendaTemplates.createdAt))
      .limit(1)
    templateId = tpl?.id ?? null
  }

  const [row] = await db.insert(schema.meetings).values({
    date,
    themeEn: body?.themeEn ? String(body.themeEn) : null,
    themeFr: body?.themeFr ? String(body.themeFr) : null,
    location: body?.location ? String(body.location) : null,
    notesEn: body?.notesEn ? String(body.notesEn) : null,
    notesFr: body?.notesFr ? String(body.notesFr) : null,
    templateId,
    createdBy: user.id,
  }).returning()

  await renumberMeetings()
  return { meeting: row }
})
