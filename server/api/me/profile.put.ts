import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Update the current member's profile (issue #61). Only the fields present in
 * the body are changed; bio/goals/phone are trimmed (empty ⇒ null) and the
 * handler only ever writes the caller's own row. Returns the saved shape.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const body = await readBody(event)

  const set: Record<string, unknown> = {}
  if (body?.bio !== undefined) set.bio = String(body.bio).trim() || null
  if (body?.goals !== undefined) set.goals = String(body.goals).trim() || null
  if (body?.phone !== undefined) set.phone = String(body.phone).trim() || null
  if (body?.showContactInfo !== undefined) set.showContactInfo = Boolean(body.showContactInfo)

  if (Object.keys(set).length > 0) {
    await useDrizzle().update(schema.users).set(set).where(eq(schema.users.id, user.id))
  }

  const [row] = await useDrizzle()
    .select({
      bio: schema.users.bio,
      goals: schema.users.goals,
      phone: schema.users.phone,
      showContactInfo: schema.users.showContactInfo,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)

  return {
    bio: row?.bio ?? null,
    goals: row?.goals ?? null,
    phone: row?.phone ?? null,
    showContactInfo: row?.showContactInfo ?? true,
  }
})
