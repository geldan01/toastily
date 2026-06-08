import { and, eq, gt, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/** Confirm an account via the emailed verification token, then log the user in. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = String(body?.token ?? '')
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Missing token' })

  const db = useDrizzle()
  const [row] = await db.select()
    .from(schema.emailTokens)
    .where(and(
      eq(schema.emailTokens.token, token),
      eq(schema.emailTokens.type, 'verify'),
      isNull(schema.emailTokens.usedAt),
      gt(schema.emailTokens.expiresAt, new Date()),
    ))
    .limit(1)

  if (!row) throw createError({ statusCode: 400, statusMessage: 'Invalid or expired link' })

  await db.update(schema.emailTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.emailTokens.id, row.id))

  const [user] = await db.update(schema.users)
    .set({ emailVerified: true })
    .where(eq(schema.users.id, row.userId))
    .returning()

  await setUserSession(event, { user: toSessionUser(user) })
  return { ok: true }
})
