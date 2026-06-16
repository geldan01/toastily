import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Internal announcements (PRD §7.1, issue #17). Officer-authored notes shown to
 * members in the Members area. Unlike public News (§5.3) these are short-lived
 * internal messages, so they are single-body — not bilingual paired columns.
 *
 * `pinned` floats a message to the top of the list; `expiresAt` (optional) hides
 * it once past — both null/false ⇒ an ordinary, indefinite announcement.
 * `authorId` keeps attribution but survives the author's deletion (set null).
 */
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  body: text('body').notNull(),
  pinned: boolean('pinned').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
