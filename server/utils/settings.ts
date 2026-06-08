import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../db/client'

type SettingsMap = Record<string, string>

const TTL_MS = 60_000
let cache: { data: SettingsMap, at: number } | null = null

/**
 * Public (non-admin-only) settings as a key→value map, cached briefly.
 * Safe to expose to the client. Admin-only rows (Resend key, etc.) are excluded.
 */
export async function getPublicSettings(): Promise<SettingsMap> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data

  const rows = await useDrizzle()
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.isAdminOnly, false))

  const data: SettingsMap = {}
  for (const row of rows) data[row.key] = row.value ?? ''
  cache = { data, at: Date.now() }
  return data
}

/**
 * Single setting value by key (server-side only — includes admin-only rows).
 */
export async function getSetting(key: string): Promise<string | undefined> {
  const rows = await useDrizzle()
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1)
  return rows[0]?.value ?? undefined
}

export function clearSettingsCache() {
  cache = null
}
