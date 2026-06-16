import { desc, eq, gt, isNull, or } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Internal announcements (PRD §7.1, issue #17) — visible to any logged-in
 * member. Returns the currently-active messages (no expiry, or not yet expired)
 * with pinned ones floated to the top, newest first. Officer authoring lives in
 * the sibling POST route; deletion in [id].delete.ts.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'member')
  const db = useDrizzle()

  const rows = await db
    .select({
      id: schema.messages.id,
      body: schema.messages.body,
      pinned: schema.messages.pinned,
      expiresAt: schema.messages.expiresAt,
      createdAt: schema.messages.createdAt,
      authorName: schema.users.name,
    })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.users.id, schema.messages.authorId))
    .where(or(isNull(schema.messages.expiresAt), gt(schema.messages.expiresAt, new Date())))
    .orderBy(desc(schema.messages.pinned), desc(schema.messages.createdAt))

  return { messages: rows }
})
