import { desc, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Fresh current-user info from the DB (status may differ from the cookie after a
 * promotion). Refreshes the session so the header stays in sync, and includes
 * the latest membership-request status for the account page.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })

  await setUserSession(event, { user: toSessionUser(user) })

  const [latestRequest] = await useDrizzle()
    .select({ status: schema.membershipRequests.status })
    .from(schema.membershipRequests)
    .where(eq(schema.membershipRequests.userId, user.id))
    .orderBy(desc(schema.membershipRequests.createdAt))
    .limit(1)

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    locale: user.locale,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarKey ? publicUrlForKey(user.avatarKey) : null,
    membershipRequestStatus: latestRequest?.status ?? null,
  }
})
