import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Mentorship pairings (PRD §11, issue #62) — a membership officer records who
 * mentors whom. Append/temporal per the "history is first-class" rule: the
 * current pairing is the row with `endedAt` null; ending a pairing keeps the
 * historical record. A mentor may have many concurrent mentees; a mentee has at
 * most one current mentor (enforced in the API, not the schema, so a member can
 * still appear in past pairings).
 *
 * Both participants are members (`user_id`s) — unlike signups/speeches there is
 * no guest path here, since mentoring is roster-internal.
 */
export const mentorships = pgTable('mentorships', {
  id: uuid('id').defaultRandom().primaryKey(),
  mentorUserId: uuid('mentor_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  menteeUserId: uuid('mentee_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Mentorship = typeof mentorships.$inferSelect
