import { asc } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** List notification templates (officer/admin). PRD §10. */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'officer')
  const templates = await useDrizzle()
    .select()
    .from(schema.emailTemplates)
    .orderBy(asc(schema.emailTemplates.key))
  return { templates, configured: await isEmailConfigured() }
})
