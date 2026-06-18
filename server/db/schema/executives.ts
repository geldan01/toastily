import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Executive officer positions (PRD §3.2, issue #47) — DB-managed, EN/FR, fully
 * editable by admin. Write authority is data-driven (CLAUDE.md: roles are data,
 * not enums) and modelled as one boolean per **functional group** of the
 * executive hub, so the per-position write-access matrix (Permissions page) maps
 * one cell ↔ one column:
 *  - `writePeople`        — assign executive positions, manage permissions;
 *  - `writeMeetings`      — meetings/holidays, agenda, meeting minutes;
 *  - `writeContent`       — News, testimonials, landing content;
 *  - `writeCommunication` — email members, scheduled/triggered notifications;
 *  - `writeConfig`        — club settings.
 * The matrix is keyed to positions, not people: reassigning a position to a new
 * member never changes its write access. Admins implicitly hold every group.
 * Seeded with the standard Toastmasters set; admins adjust per club.
 */
export const executivePositions = pgTable('executive_positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameEn: text('name_en').notNull(),
  nameFr: text('name_fr').notNull(),
  writePeople: boolean('write_people').notNull().default(false),
  writeMeetings: boolean('write_meetings').notNull().default(false),
  writeContent: boolean('write_content').notNull().default(false),
  writeCommunication: boolean('write_communication').notNull().default(false),
  writeConfig: boolean('write_config').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * The functional groups of the executive hub that carry a write-access column in
 * the per-position permissions matrix (issue #47). Order matches the hub.
 */
export const PERMISSION_GROUPS = ['people', 'meetings', 'content', 'communication', 'config'] as const
export type PermissionGroup = typeof PERMISSION_GROUPS[number]

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
