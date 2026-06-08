import { schema, useDrizzle } from '../../db/client'

/** All settings as a key→value map (admin only — includes admin-only rows). */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')

  const rows = await useDrizzle().select().from(schema.settings)
  const settings: Record<string, string> = {}
  for (const row of rows) settings[row.key] = row.value ?? ''
  return { settings }
})
