import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../server/db/schema'
import { TEST_DATABASE_URL } from './config'

/**
 * A direct Drizzle client against the TEST database, used by global-setup (to
 * seed/promote accounts) and by integration specs that need to assert on or
 * read data the HTTP API doesn't expose (e.g. the email verification token).
 *
 * Deliberately separate from server/db/client.ts so tests never accidentally
 * reuse the app's connection pool or its DATABASE_URL.
 */
let _client: ReturnType<typeof postgres> | undefined

export function testDb() {
  _client ??= postgres(TEST_DATABASE_URL, { max: 4 })
  return drizzle(_client, { schema })
}

export async function closeTestDb() {
  await _client?.end({ timeout: 5 })
  _client = undefined
}

export { schema }
