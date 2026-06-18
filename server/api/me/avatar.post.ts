import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Upload (or replace) the current member's own profile picture (issue #43).
 *
 * Self-service: any member+ may set their *own* avatar — unlike the
 * content-manager-gated /api/uploads — and the handler only ever writes the
 * caller's row, so a member can never change someone else's picture. Reuses the
 * shared S3 image pipeline (validate type/size → store under a random key).
 * Returns the new public URL. The previous object, if any, is best-effort
 * deleted so replaced pictures don't accumulate in the bucket.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')

  const { key, url } = await storeImageUpload(event)

  const db = useDrizzle()
  const [prev] = await db
    .select({ avatarKey: schema.users.avatarKey })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)

  await db.update(schema.users).set({ avatarKey: key }).where(eq(schema.users.id, user.id))

  if (prev?.avatarKey && prev.avatarKey !== key) {
    await deleteStoredObject(prev.avatarKey)
  }

  return { avatarKey: key, avatarUrl: url }
})
