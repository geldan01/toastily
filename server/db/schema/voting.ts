import { boolean, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { meetings } from './meetings'
import { users } from './users'

/**
 * In-meeting award voting (PRD §8). The four standard award categories. A ballot
 * (vote session) is opened per meeting per category by a meeting manager
 * (officer/admin OR the meeting's Sergeant-at-Arms / Toastmaster — authority is
 * data via the role's `grantsMeetingAuthority` flag, never a hard-coded name).
 */
export const voteCategory = pgEnum('vote_category', [
  'best_speaker',
  'best_evaluator',
  'best_table_topics_speaker',
  'best_table_topics_evaluator',
])

/** A ballot's lifecycle (PRD §8): `draft` (the meeting manager is curating the
 * candidate list — visible to managers, not yet votable), `open` (votes
 * accepted), `closed` (results revealed). The opener can reopen a closed ballot
 * to fix mistakes — flips back to `open`. */
export const voteSessionStatus = pgEnum('vote_session_status', ['draft', 'open', 'closed'])

/**
 * One ballot per meeting per category (unique). A ballot starts as a `draft` when
 * the manager opens "Manage candidates" (speech candidates are pre-derived then;
 * table-topics drafts start empty), flips to `open` to accept votes, and `closed`
 * to reveal results (PRD §8). Reopening preserves cast ballots.
 */
export const voteSessions = pgTable('vote_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  category: voteCategory('category').notNull(),
  status: voteSessionStatus('status').notNull().default('open'),
  openedBy: uuid('opened_by').references(() => users.id, { onDelete: 'set null' }),
  closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('vote_session_meeting_category').on(t.meetingId, t.category)])

/**
 * A candidate on a ballot — a member (`userId`) OR a guest (`guestName`), like
 * every other participant in the app. Speech-category candidates are derived
 * from the meeting's speeches when the draft is prepared; table-topics candidates
 * are added live by the meeting manager. `excluded` strikes a candidate out
 * (e.g. an over-time speaker) — the row and any cast votes are kept, but they are
 * non-votable and never count as a winner.
 */
export const voteCandidates = pgTable('vote_candidates', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => voteSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  guestName: text('guest_name'),
  excluded: boolean('excluded').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * A single anonymous vote. Identity is a lightweight per-device cookie token
 * (PRD §8: anyone present votes once per category); `unique(session, token)`
 * enforces one ballot per device, and re-voting updates the chosen candidate.
 */
export const voteBallots = pgTable('vote_ballots', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => voteSessions.id, { onDelete: 'cascade' }),
  candidateId: uuid('candidate_id').notNull().references(() => voteCandidates.id, { onDelete: 'cascade' }),
  voterToken: text('voter_token').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('vote_ballot_one_per_token').on(t.sessionId, t.voterToken)])

export type VoteCategory = (typeof voteCategory.enumValues)[number]
export type VoteSession = typeof voteSessions.$inferSelect
export type VoteCandidate = typeof voteCandidates.$inferSelect
export type VoteBallot = typeof voteBallots.$inferSelect
