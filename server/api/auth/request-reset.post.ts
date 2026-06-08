import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/** Start a password reset. Always returns ok so we don't leak which emails exist. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = String(body?.email ?? '').trim().toLowerCase()

  if (email.includes('@')) {
    const [user] = await useDrizzle()
      .select({ id: schema.users.id, passwordHash: schema.users.passwordHash })
      .from(schema.users).where(eq(schema.users.email, email)).limit(1)

    if (user?.passwordHash) {
      const token = await createEmailToken(user.id, 'reset')
      await deliverAuthLink('reset', email, buildAuthLink('reset', token))
    }
  }

  return { ok: true }
})
