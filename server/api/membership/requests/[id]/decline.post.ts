import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../../db/client'

/** Decline a pending membership request (officer/admin). */
export default defineEventHandler(async (event) => {
  const officer = await requireMinRole(event, 'officer')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const db = useDrizzle()
  const [request] = await db.select()
    .from(schema.membershipRequests)
    .where(eq(schema.membershipRequests.id, id))
    .limit(1)

  if (!request) throw createError({ statusCode: 404, statusMessage: 'Request not found' })
  if (request.status !== 'pending') {
    throw createError({ statusCode: 400, statusMessage: 'Request already decided' })
  }

  await db.update(schema.membershipRequests)
    .set({ status: 'declined', decidedBy: officer.id, decidedAt: new Date() })
    .where(eq(schema.membershipRequests.id, id))

  return { ok: true }
})
