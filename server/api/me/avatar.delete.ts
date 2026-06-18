import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Remove the current member's own profile picture (issue #43). Clears the
 * `avatar_key` column (the UI then falls back to a default initials avatar) and
 * best-effort deletes the stored object. Idempotent: succeeds even when no
 * picture is set. Only ever touches the caller's row.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')

  const db = useDrizzle()
  const [prev] = await db
    .select({ avatarKey: schema.users.avatarKey })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)

  if (prev?.avatarKey) {
    await db.update(schema.users).set({ avatarKey: null }).where(eq(schema.users.id, user.id))
    await deleteStoredObject(prev.avatarKey)
  }

  return { avatarKey: null, avatarUrl: null }
})
