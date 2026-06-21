import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Internal announcements (PRD §7.1, issues #17/#63). Officer-authored notes
 * shown to members in the Members area. As user-generated content they are
 * **bilingual**: paired `*_en`/`*_fr` title + body columns, all required before
 * publishing (the bilingual content rule — see CLAUDE.md). Authoring is gated on
 * the communication-group capability (`canManageCommunication`), never a
 * hard-coded role.
 *
 * `pinned` floats a message to the top of the list; `expiresAt` (optional) hides
 * it once past — both null/false ⇒ an ordinary, indefinite announcement.
 * `authorId` keeps attribution but survives the author's deletion (set null).
 */
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  titleEn: text('title_en').notNull(),
  titleFr: text('title_fr').notNull(),
  bodyEn: text('body_en').notNull(),
  bodyFr: text('body_fr').notNull(),
  pinned: boolean('pinned').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
