import { boolean, date, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { speeches } from './meetings'
import { users } from './users'

/**
 * Pathways progress tracker (issue #58, Phase 2 lite). A LIGHTWEIGHT,
 * SELF-TRACKED personal view — NOT a replacement for the official Toastmasters
 * Base Camp, which remains the system of record for Pathways. Members still
 * complete and mark their projects done in Base Camp; this is a convenience
 * overview inside Toastily and confers no official credit (the UI shows this
 * caveat prominently).
 *
 * The richer Pathways catalog (levels/projects per path with their official
 * structure) is a later Phase 2 feature; here projects are free-text and
 * self-reported.
 */

/**
 * The official Toastmasters International learning paths. Globally fixed (the
 * same 11 worldwide — NOT club-specific config), seeded with bilingual names so
 * the picker localizes like every other DB-managed label. No admin UI: paths are
 * defined by Toastmasters, not the club.
 */
export const pathwaysPaths = pgTable('pathways_paths', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameEn: text('name_en').notNull(),
  nameFr: text('name_fr').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * A member's enrollment in a path (history is first-class — a member may take
 * several paths over time). `isCurrent` flags the path they're actively working;
 * `completedAt` marks a path finished. Self-reported dates, both optional.
 */
export const memberPathways = pgTable('member_pathways', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pathId: uuid('path_id').notNull().references(() => pathwaysPaths.id, { onDelete: 'restrict' }),
  isCurrent: boolean('is_current').notNull().default(false),
  startedAt: date('started_at'),
  completedAt: date('completed_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('member_pathway_unique').on(t.userId, t.pathId)])

/**
 * A self-reported completed project within an enrollment. Each Pathways path has
 * five levels; `level` is 1–5 (validated in the API). `title` is free text (the
 * official project catalog is a later phase). A project may optionally be tied to
 * a club `speech` the member delivered for it (`speechId`) — and when tied, the
 * existing `speeches.pathways_project` placeholder is mirrored with the title so
 * the link is reflected wherever speeches are shown.
 */
export const memberPathwayProjects = pgTable('member_pathway_projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  enrollmentId: uuid('enrollment_id').notNull().references(() => memberPathways.id, { onDelete: 'cascade' }),
  level: integer('level').notNull(),
  title: text('title').notNull(),
  completedAt: date('completed_at'),
  speechId: uuid('speech_id').references(() => speeches.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type PathwaysPath = typeof pathwaysPaths.$inferSelect
export type MemberPathway = typeof memberPathways.$inferSelect
export type NewMemberPathway = typeof memberPathways.$inferInsert
export type MemberPathwayProject = typeof memberPathwayProjects.$inferSelect
export type NewMemberPathwayProject = typeof memberPathwayProjects.$inferInsert
