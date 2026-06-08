import { sql } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Upsert a partial map of settings (admin only). New keys are created as
 * public (is_admin_only = false); existing rows keep their flag and only have
 * their value updated. Clears the public-settings cache afterwards.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')

  const body = await readBody(event)
  const updates = body?.settings
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw createError({ statusCode: 400, statusMessage: 'Expected { settings: { key: value } }' })
  }

  const db = useDrizzle()
  for (const [key, raw] of Object.entries(updates)) {
    const value = raw == null ? '' : String(raw)
    await db.insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value, updatedAt: sql`now()` },
      })
  }

  clearSettingsCache()
  return { ok: true }
})
