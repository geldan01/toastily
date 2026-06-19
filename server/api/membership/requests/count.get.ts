import { count, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Number of pending membership requests (officer/admin) — drives the hub badge (issue #50). */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'officer')

  const [row] = await useDrizzle()
    .select({ pending: count() })
    .from(schema.membershipRequests)
    .where(eq(schema.membershipRequests.status, 'pending'))

  return { pending: row?.pending ?? 0 }
})
