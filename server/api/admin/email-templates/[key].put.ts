import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Update a notification template's bilingual subject + body (officer/admin).
 * The `key` is immutable (it's referenced by schedules and the send code), so
 * only the editable copy fields change. PRD §10.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'officer')
  const key = getRouterParam(event, 'key')!
  const body = await readBody(event)

  const subjectEn = String(body?.subjectEn ?? '').trim()
  const subjectFr = String(body?.subjectFr ?? '').trim()
  const bodyEn = String(body?.bodyEn ?? '').trim()
  const bodyFr = String(body?.bodyFr ?? '').trim()
  if (!subjectEn || !subjectFr || !bodyEn || !bodyFr) {
    throw createError({ statusCode: 400, statusMessage: 'Subject and body are required in both English and French.' })
  }

  const db = useDrizzle()
  const [existing] = await db.select({ id: schema.emailTemplates.id })
    .from(schema.emailTemplates).where(eq(schema.emailTemplates.key, key)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Template not found.' })

  await db.update(schema.emailTemplates)
    .set({ subjectEn, subjectFr, bodyEn, bodyFr, updatedAt: new Date() })
    .where(eq(schema.emailTemplates.key, key))

  return { ok: true }
})
