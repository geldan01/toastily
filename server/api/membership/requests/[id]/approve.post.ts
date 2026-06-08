import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../../db/client'

/** Approve a membership request → promote guest to member + record history. */
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

  const [target] = await db.select()
    .from(schema.users).where(eq(schema.users.id, request.userId)).limit(1)

  await db.update(schema.membershipRequests)
    .set({ status: 'approved', decidedBy: officer.id, decidedAt: new Date() })
    .where(eq(schema.membershipRequests.id, id))

  // Promote only if still a guest (idempotent against double-approval races).
  if (target && target.status === 'guest') {
    await db.update(schema.users)
      .set({ status: 'member' })
      .where(eq(schema.users.id, target.id))
    await db.insert(schema.roleHistory).values({
      userId: target.id,
      fromStatus: 'guest',
      toStatus: 'member',
      assignedBy: officer.id,
      note: 'Membership request approved',
    })
  }

  return { ok: true }
})
