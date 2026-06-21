import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * The current member's notification preferences (issue #59): the pre-meeting
 * role-reminder opt-out and the signup-reminder opt-out. A future profiles issue
 * may add more.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')

  const [row] = await useDrizzle()
    .select({
      notifyRoleReminders: schema.users.notifyRoleReminders,
      notifySignupReminders: schema.users.notifySignupReminders,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)

  return {
    notifyRoleReminders: row?.notifyRoleReminders ?? true,
    notifySignupReminders: row?.notifySignupReminders ?? true,
  }
})
