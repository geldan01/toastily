import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * The current member's editable profile (issue #61): bio, goals, phone, and the
 * contact-visibility preference. Member-authored free text; null fields come
 * back as null so the editor renders cleanly.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')

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
