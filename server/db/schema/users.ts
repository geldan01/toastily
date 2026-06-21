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
  // Privacy consent (issue #25): recorded when the user agreed to the privacy
  // terms at registration, with the policy version in force at the time so a
  // future policy revision can require re-consent. Null ⇒ never consented
  // (pre-#25 accounts; no destructive backfill).
  privacyConsentAt: timestamp('privacy_consent_at', { withTimezone: true }),
  privacyConsentVersion: text('privacy_consent_version'),
  // Notification preference (issue #59): whether the member wants the reminder
  // email before a meeting where they hold a role or speech. Opt-out (default on);
  // respected by the role-reminder task. A future profiles issue may add more
  // granular preferences alongside this one.
  notifyRoleReminders: boolean('notify_role_reminders').notNull().default(true),
  // Notification preference: whether the member wants the "open roles & speech
  // slots — please sign up" reminder for the next meeting. Opt-out (default on);
  // respected when the signup-reminder template is sent to all members.
  notifySignupReminders: boolean('notify_signup_reminders').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
