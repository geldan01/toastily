import { and, desc, eq } from 'drizzle-orm'
import { schema, testDb } from './test-db'

/**
 * Email is "mocked" for free in tests: with no Resend key configured, the app's
 * sendEmail() falls back to a console stub (server/utils/email-service.ts), so
 * no message ever leaves the process. The verification / reset *token* still
 * lands in the `email_tokens` table, so a test simulates clicking the emailed
 * link by reading the latest unused token straight from the DB.
 */
export async function latestEmailToken(
  email: string,
  type: 'verify' | 'reset',
): Promise<string | null> {
  const db = testDb()
  const [user] = await db.select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase()))
    .limit(1)
  if (!user) return null

  const [row] = await db.select({ token: schema.emailTokens.token })
    .from(schema.emailTokens)
    .where(and(eq(schema.emailTokens.userId, user.id), eq(schema.emailTokens.type, type)))
    .orderBy(desc(schema.emailTokens.createdAt))
    .limit(1)
  return row?.token ?? null
}
