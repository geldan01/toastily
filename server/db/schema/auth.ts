import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { accountStatus, users } from './users'

/** Tokenised email links: account verification and password reset (PRD §4). */
export const emailTokenType = pgEnum('email_token_type', ['verify', 'reset'])

export const emailTokens = pgTable('email_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: emailTokenType('type').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Membership requests from guests; approved/declined by officer/admin (PRD §4.3). */
export const membershipStatus = pgEnum('membership_status', ['pending', 'approved', 'declined'])

export const membershipRequests = pgTable('membership_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: membershipStatus('status').notNull().default('pending'),
  message: text('message'),
  decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Append-only account-status history (PRD §11, §13). Records every promotion /
 * demotion with who did it. Executive-position history (P4) will extend this
 * pattern in its own table.
 */
export const roleHistory = pgTable('role_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fromStatus: accountStatus('from_status'),
  toStatus: accountStatus('to_status').notNull(),
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Delegable capability grants (PRD §3.1): content-edit and calendar-manage can
 * be granted to specific officers/members independent of account status.
 */
export const capability = pgEnum('capability', ['content_edit', 'calendar_manage'])

export const permissionGrants = pgTable('permission_grants', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  capability: capability('capability').notNull(),
  grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type EmailToken = typeof emailTokens.$inferSelect
export type MembershipRequest = typeof membershipRequests.$inferSelect
export type RoleHistory = typeof roleHistory.$inferSelect
export type PermissionGrant = typeof permissionGrants.$inferSelect
