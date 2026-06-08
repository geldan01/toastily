import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Executive officer positions (PRD §3.2) — DB-managed, EN/FR, fully editable by
 * admin. Authority is data-driven via capability flags rather than hard-coded
 * against a position name (CLAUDE.md: roles are data, not enums):
 *  - `canManageCalendar` — add/generate meetings, manage holidays;
 *  - `canManageContent`  — edit landing content & news;
 *  - `canAssignOfficers` — assign members to executive positions (President).
 * Seeded with the standard Toastmasters set; admins adjust per club.
 */
export const executivePositions = pgTable('executive_positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameEn: text('name_en').notNull(),
  nameFr: text('name_fr').notNull(),
  canManageCalendar: boolean('can_manage_calendar').notNull().default(false),
  canManageContent: boolean('can_manage_content').notNull().default(false),
  canAssignOfficers: boolean('can_assign_officers').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Executive-position assignments over time (PRD §3.2, §11). Append/temporal:
 * the current holder of a position is the row with `endedAt` null; ending an
 * assignment keeps the historical record (role-allocation history).
 */
export const executiveAssignments = pgTable('executive_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  positionId: uuid('position_id').notNull().references(() => executivePositions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ExecutivePosition = typeof executivePositions.$inferSelect
export type ExecutiveAssignment = typeof executiveAssignments.$inferSelect
