import { desc, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/** Pending membership requests (officer/admin only). */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'officer')

  return await useDrizzle()
    .select({
      id: schema.membershipRequests.id,
      message: schema.membershipRequests.message,
      createdAt: schema.membershipRequests.createdAt,
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.membershipRequests)
    .innerJoin(schema.users, eq(schema.membershipRequests.userId, schema.users.id))
    .where(eq(schema.membershipRequests.status, 'pending'))
    .orderBy(desc(schema.membershipRequests.createdAt))
})
