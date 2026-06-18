import { schema, useDrizzle } from '../../db/client'

/** All settings as a key→value map (config managers — admin or a config-writing position). */
export default defineEventHandler(async (event) => {
  await requireConfigManager(event)

  const rows = await useDrizzle().select().from(schema.settings)
  const settings: Record<string, string> = {}
  for (const row of rows) settings[row.key] = row.value ?? ''
  return { settings }
})
