import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')

  const [user] = await useDrizzle()
    .select().from(schema.users).where(eq(schema.users.email, email)).limit(1)

  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }
  if (!user.emailVerified) {
    throw createError({ statusCode: 403, statusMessage: 'Please verify your email first' })
  }

  await setUserSession(event, { user: toSessionUser(user) })
  return { ok: true }
})
