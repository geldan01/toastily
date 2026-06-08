import { asc, desc, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * The agenda template editor's data (admin): the default template (or the
 * first one) with its ordered items, plus the active meeting roles available
 * to bind each item to. PRD §6.4.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')
  const db = useDrizzle()

  const [template] = await db.select()
    .from(schema.agendaTemplates)
    .orderBy(desc(schema.agendaTemplates.isDefault), asc(schema.agendaTemplates.createdAt))
    .limit(1)

  const items = template
    ? await db.select()
        .from(schema.agendaTemplateItems)
        .where(eq(schema.agendaTemplateItems.templateId, template.id))
        .orderBy(asc(schema.agendaTemplateItems.sortOrder))
    : []

  const roles = await db.select({
    id: schema.meetingRoles.id,
    nameEn: schema.meetingRoles.nameEn,
    nameFr: schema.meetingRoles.nameFr,
  })
    .from(schema.meetingRoles)
    .where(eq(schema.meetingRoles.active, true))
    .orderBy(asc(schema.meetingRoles.sortOrder))

  return { template: template ? { ...template, items } : null, roles }
})
