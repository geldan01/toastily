import { desc, eq, gt, isNull, or } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Internal announcements (PRD §7.1, issues #17/#63) — visible to any logged-in
 * member. Returns the currently-active messages (no expiry, or not yet expired)
 * with pinned ones floated to the top, newest first. Bodies are bilingual; the
 * client renders the viewer's locale. Authoring lives in the sibling POST route;
 * deletion in [id].delete.ts.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'member')
  const db = useDrizzle()

  const rows = await db
    .select({
      id: schema.messages.id,
      titleEn: schema.messages.titleEn,
      titleFr: schema.messages.titleFr,
      bodyEn: schema.messages.bodyEn,
      bodyFr: schema.messages.bodyFr,
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
