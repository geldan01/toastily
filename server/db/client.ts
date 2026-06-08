import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

declare global {
  // Reuse the pool across HMR reloads in dev so we don't exhaust connections.

  var __toastilyPg: ReturnType<typeof postgres> | undefined
}

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined

/**
 * Lazily-initialised Drizzle client. Connection comes from DATABASE_URL
 * (never committed — see .env.example). Initialised on first use so routes
 * that don't touch the DB don't fail when it's unconfigured.
 */
export function useDrizzle() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL ?? process.env.NUXT_DATABASE_URL ?? ''
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Copy .env.example to .env and configure your Postgres connection.',
      )
    }
    const client = globalThis.__toastilyPg ?? postgres(connectionString, { max: 10 })
    if (process.env.NODE_ENV !== 'production') globalThis.__toastilyPg = client
    _db = drizzle(client, { schema })
  }
  return _db
}

export { schema }
