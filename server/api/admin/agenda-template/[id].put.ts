import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

type ItemType = 'item' | 'speeches' | 'evaluations'
const BLOCK_TYPES: ItemType[] = ['speeches', 'evaluations']
type Section = 'administrative' | 'speeches' | 'table_topics' | 'evaluations'
const SECTIONS: Section[] = ['administrative', 'speeches', 'table_topics', 'evaluations']

interface ItemInput {
  itemType?: ItemType
  section?: Section
  labelEn?: string
  labelFr?: string
  durationMinutes?: number | string | null
  meetingRoleId?: string | null
}

/**
 * Replace a template's name and full ordered item list (admin). Items are not
 * referenced by any historical record (agendas are generated on the fly), so
 * we delete-and-reinsert; sortOrder follows array position. PRD §6.4.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const nameEn = String(body?.nameEn ?? '').trim()
  const nameFr = String(body?.nameFr ?? '').trim()
  if (!nameEn || !nameFr) {
    throw createError({ statusCode: 400, statusMessage: 'Template needs an English and French name.' })
  }
  const items: ItemInput[] = Array.isArray(body?.items) ? body.items : []
  for (const it of items) {
    if (!String(it.labelEn ?? '').trim() || !String(it.labelFr ?? '').trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Every agenda item needs an English and French label.' })
    }
  }

  const db = useDrizzle()
  const [template] = await db.select({ id: schema.agendaTemplates.id })
    .from(schema.agendaTemplates)
    .where(eq(schema.agendaTemplates.id, id))
    .limit(1)
  if (!template) throw createError({ statusCode: 404, statusMessage: 'Template not found.' })

  await db.transaction(async (tx) => {
    await tx.update(schema.agendaTemplates).set({ nameEn, nameFr }).where(eq(schema.agendaTemplates.id, id))
    await tx.delete(schema.agendaTemplateItems).where(eq(schema.agendaTemplateItems.templateId, id))
    if (items.length > 0) {
      await tx.insert(schema.agendaTemplateItems).values(items.map((it, i) => {
        const isBlock = BLOCK_TYPES.includes(it.itemType as ItemType)
        const itemType: ItemType = isBlock ? it.itemType as ItemType : 'item'
        const duration = it.durationMinutes === '' || it.durationMinutes == null ? null : Number(it.durationMinutes)
        return {
          templateId: id,
          sortOrder: i,
          itemType,
          // The speeches/evaluations blocks always live in their own section.
          section: itemType === 'speeches'
            ? 'speeches' as const
            : itemType === 'evaluations'
              ? 'evaluations' as const
              : (SECTIONS.includes(it.section as Section) ? it.section as Section : 'administrative' as const),
          labelEn: String(it.labelEn ?? '').trim(),
          labelFr: String(it.labelFr ?? '').trim(),
          durationMinutes: Number.isFinite(duration) ? duration : null,
          meetingRoleId: isBlock ? null : (it.meetingRoleId || null),
        }
      }))
    }
  })

  return { ok: true }
})
