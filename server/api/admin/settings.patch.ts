import { sql } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Integer-valued settings surfaced in /admin/settings, with their minimum.
 * Validated server-side so the DB never holds a value that would silently fall
 * back to a default (or break Number() consumers) at read time.
 */
const INT_SETTINGS: Record<string, number> = {
  'speech.default_min_minutes': 1,
  'speech.default_max_minutes': 1,
  'speech.agenda_buffer_minutes': 0,
  'meeting.frequency_weeks': 1,
  'meeting.number_start': 1,
}

/** Validate a single key/value, throwing a 400 with a readable message. */
function validate(key: string, value: string): void {
  if (key in INT_SETTINGS) {
    const n = Number(value)
    if (!Number.isInteger(n) || n < INT_SETTINGS[key]!) {
      throw createError({
        statusCode: 400,
        statusMessage: `${key} must be a whole number ≥ ${INT_SETTINGS[key]}`,
      })
    }
  }
  if (key === 'qr.target_url' && value) {
    let ok = false
    try {
      const u = new URL(value)
      ok = u.protocol === 'http:' || u.protocol === 'https:'
    }
    catch {
      ok = false
    }
    if (!ok) {
      throw createError({ statusCode: 400, statusMessage: 'qr.target_url must be a valid http(s) URL' })
    }
  }
}

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

  // Normalise to strings, then validate before writing anything.
  const entries = Object.entries(updates).map(([key, raw]) => [key, raw == null ? '' : String(raw)] as const)
  for (const [key, value] of entries) validate(key, value)

  // Cross-field: the speech window must be min ≤ max when both are present.
  const map = Object.fromEntries(entries)
  if ('speech.default_min_minutes' in map && 'speech.default_max_minutes' in map
    && Number(map['speech.default_min_minutes']) > Number(map['speech.default_max_minutes'])) {
    throw createError({ statusCode: 400, statusMessage: 'speech.default_min_minutes must be ≤ speech.default_max_minutes' })
  }

  const db = useDrizzle()
  for (const [key, value] of entries) {
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
