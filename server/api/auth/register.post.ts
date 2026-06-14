import { eq, sql } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')
  const name = String(body?.name ?? '').trim()
  const locale = body?.locale === 'fr' ? 'fr' : 'en'

  if (!email.includes('@') || password.length < 8 || !name) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid registration details' })
  }

  const db = useDrizzle()

  const [existing] = await db.select({ id: schema.users.id, emailVerified: schema.users.emailVerified })
    .from(schema.users).where(eq(schema.users.email, email)).limit(1)
  if (existing) {
    // A *verified* account already owns this email — the right action is to log in.
    if (existing.emailVerified) {
      throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
    }
    // Unverified account, e.g. a prior attempt whose confirmation email never
    // arrived: restart its registration rather than dead-end on a 409. Refresh
    // the (unowned) credentials and re-send a fresh verification link. Safe
    // because the account stays unusable until the email is confirmed.
    await db.update(schema.users)
      .set({ name, passwordHash: await hashPassword(password), locale })
      .where(eq(schema.users.id, existing.id))
    const token = await createEmailToken(existing.id, 'verify')
    await deliverAuthLink('verify', email, buildAuthLink('verify', token))
    return { ok: true, status: 'guest', verified: false }
  }

  // Bootstrap: the first registered user becomes a verified admin and is logged
  // in immediately. Everyone after is a guest who must confirm their email.
  const [{ c: userCount }] = await db.select({ c: sql<number>`count(*)::int` }).from(schema.users)
  const isFirst = userCount === 0

  const passwordHash = await hashPassword(password)
  const [user] = await db.insert(schema.users).values({
    email,
    name,
    passwordHash,
    locale,
    status: isFirst ? 'admin' : 'guest',
    emailVerified: isFirst,
  }).returning()

  if (isFirst) {
    await db.insert(schema.roleHistory).values({
      userId: user.id,
      toStatus: 'admin',
      note: 'Bootstrap: first registered user',
    })
    await setUserSession(event, { user: toSessionUser(user) })
    return { ok: true, status: 'admin', verified: true }
  }

  const token = await createEmailToken(user.id, 'verify')
  await deliverAuthLink('verify', email, buildAuthLink('verify', token))
  return { ok: true, status: 'guest', verified: false }
})
