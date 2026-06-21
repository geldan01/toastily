import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Update the current member's notification preferences (issue #59). Only the
 * fields present in the body are changed; values are coerced to booleans.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const body = await readBody(event)

  const set: Record<string, unknown> = {}
  if (body?.notifyRoleReminders !== undefined) {
    set.notifyRoleReminders = Boolean(body.notifyRoleReminders)
  }
  if (body?.notifySignupReminders !== undefined) {
    set.notifySignupReminders = Boolean(body.notifySignupReminders)
  }

  if (Object.keys(set).length > 0) {
    await useDrizzle().update(schema.users).set(set).where(eq(schema.users.id, user.id))
  }

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
