import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { meetings, speeches } from './meetings'
import { users } from './users'

/**
 * Digital written evaluations (issue #60, peer feedback): anyone *checked in* to a
 * meeting — a member (`meeting_attendance`) or a checked-in guest
 * (`guest_checkins`) — may leave a short written evaluation of a prepared speech.
 * This is broader than the agenda's formal evaluator slot (peer feedback from the
 * room); the formal evaluator role is unchanged.
 *
 * The evaluator is a member (`evaluatorUserId`) OR a guest (`evaluatorGuestName`),
 * mirroring the member-or-guest pattern used everywhere participation is recorded.
 * One evaluation per evaluator per speech — re-submitting updates the existing row
 * (the member uniqueness is enforced by the constraint below; guest re-submits are
 * deduped in the API by case-insensitive name). The two free-text fields are
 * optional; the three star ratings are required 1–5 integers (validated in the
 * API). The speaker reads back the evaluations they received in their
 * participation timeline (PRD §11).
 */
export const writtenEvaluations = pgTable('written_evaluations', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  speechId: uuid('speech_id').notNull().references(() => speeches.id, { onDelete: 'cascade' }),
  // Evaluator: a member OR a checked-in guest (never hard-require an account).
  evaluatorUserId: uuid('evaluator_user_id').references(() => users.id, { onDelete: 'cascade' }),
  evaluatorGuestName: text('evaluator_guest_name'),
  // The form: what you liked, what you recommend (both optional free text).
  liked: text('liked'),
  recommend: text('recommend'),
  // Three star ratings, 1–5 (required; bounds enforced in the API).
  structureRating: integer('structure_rating').notNull(),
  vocalVarietyRating: integer('vocal_variety_rating').notNull(),
  gesturesRating: integer('gestures_rating').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  // One evaluation per member per speech (Postgres treats NULL evaluator ids as
  // distinct, so guest rows are deduped by name in the API instead).
  unique('written_eval_member_unique').on(t.speechId, t.evaluatorUserId),
])

export type WrittenEvaluation = typeof writtenEvaluations.$inferSelect
export type NewWrittenEvaluation = typeof writtenEvaluations.$inferInsert
