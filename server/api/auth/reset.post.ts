import { and, eq, gt, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/** Complete a password reset with a valid token + new password. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = String(body?.token ?? '')
  const password = String(body?.password ?? '')

  if (!token || password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid token or password' })
  }

  const db = useDrizzle()
  const [row] = await db.select()
    .from(schema.emailTokens)
    .where(and(
      eq(schema.emailTokens.token, token),
      eq(schema.emailTokens.type, 'reset'),
      isNull(schema.emailTokens.usedAt),
      gt(schema.emailTokens.expiresAt, new Date()),
    ))
    .limit(1)

  if (!row) throw createError({ statusCode: 400, statusMessage: 'Invalid or expired link' })

  const passwordHash = await hashPassword(password)
  await db.update(schema.users)
    .set({ passwordHash, emailVerified: true })
    .where(eq(schema.users.id, row.userId))
  await db.update(schema.emailTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.emailTokens.id, row.id))

  return { ok: true }
})
