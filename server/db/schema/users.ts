import { boolean, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Account-level access ladder (PRD §3.1): guest → member → officer → admin.
 * Officer implies member. Delegable capabilities and meeting-contextual
 * authority are modelled separately (added in P2 — Auth & membership).
 */
export const accountStatus = pgEnum('account_status', [
  'guest',
  'member',
  'officer',
  'admin',
])

/**
 * Stub user table. Only the columns needed so far (and the FK target for
 * news.author_id) are defined here; the full auth/membership model lands in P2.
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  // Nullable: news.author placeholders / future SSO accounts may have no password.
  passwordHash: text('password_hash'),
  status: accountStatus('status').notNull().default('guest'),
  locale: text('locale').notNull().default('en'),
  emailVerified: boolean('email_verified').notNull().default(false),
  // Self-service profile picture (issue #43): the S3 object key for the member's
  // avatar (see server/utils/s3.ts). Null ⇒ render a default initials avatar.
  avatarKey: text('avatar_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
