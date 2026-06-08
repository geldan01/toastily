import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/** A logged-in guest requests membership (PRD §4.3). */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  if (user.status !== 'guest') {
    throw createError({ statusCode: 400, statusMessage: 'Only guests can request membership' })
  }

  const body = await readBody(event).catch(() => ({}))
  const message = body?.message ? String(body.message).slice(0, 1000) : null

  const db = useDrizzle()
  const [existing] = await db.select({ id: schema.membershipRequests.id })
    .from(schema.membershipRequests)
    .where(and(
      eq(schema.membershipRequests.userId, user.id),
      eq(schema.membershipRequests.status, 'pending'),
    ))
    .limit(1)
  if (existing) return { ok: true, status: 'pending' }

  await db.insert(schema.membershipRequests).values({ userId: user.id, message })
  return { ok: true, status: 'pending' }
})
