import { boolean, date, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Meeting roles — DB-managed, fully admin-editable (PRD §3.3, §6.2). Never
 * hard-code role names or business logic against a specific label. Seeded with
 * a generic Toastmasters set; admins add/rename/reorder/deactivate freely.
 */
export const meetingRoles = pgTable('meeting_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameEn: text('name_en').notNull(),
  nameFr: text('name_fr').notNull(),
  descriptionEn: text('description_en'),
  descriptionFr: text('description_fr'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  // Whether the member signed up for this role gains meeting-level authority for
  // that meeting (assign/reassign/release any signup — e.g. the Toastmaster).
  // Data-driven so authority is never hard-coded against a role name (PRD §3).
  grantsMeetingAuthority: boolean('grants_meeting_authority').notNull().default(false),
  // Whether the holder of this role is a candidate for the Best Evaluator award
  // alongside the speech evaluators (PRD §8: "one of the evaluators or the
  // Grammarian"). Data-driven so we never match the Grammarian by name.
  countsAsEvaluator: boolean('counts_as_evaluator').notNull().default(false),
  // Whether this role is a meeting officer, listed in the agenda's Meeting
  // Officers block so the chair can introduce them at the start of the meeting.
  // Data-driven so officer-ness is never hard-coded against a role name.
  isMeetingOfficer: boolean('is_meeting_officer').notNull().default(false),
  // Whether the member signed up for this role is the meeting's minutes secretary
  // (may author this meeting's minutes — PRD §6, issue #14). Data-driven so the
  // secretary is identified by flag per meeting, never by the literal name.
  isMinutesSecretary: boolean('is_minutes_secretary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Agenda templates (PRD §6.4): an ordered list of timed items, each optionally
 * bound to a meeting role. DB-managed by admin. One template may be the default
 * applied to new meetings.
 */
export const agendaTemplates = pgTable('agenda_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameEn: text('name_en').notNull(),
  nameFr: text('name_fr').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * An agenda item is one of:
 *  - `item`        a normal line, optionally bound to a meeting role whose
 *                  signed-up person fills it;
 *  - `speeches`    a placeholder that expands per prepared speech, showing each
 *                  speech's title + presenter (the education session);
 *  - `evaluations` a placeholder that expands per prepared speech, showing each
 *                  speech's evaluator (the later evaluation session).
 * Splitting speeches/evaluations lets a club place presenters and evaluators in
 * different parts of the agenda (PRD §6.3, §6.4).
 */
export const agendaItemType = pgEnum('agenda_item_type', ['item', 'speeches', 'evaluations'])

/**
 * The agenda is rendered in four sections: an administrative segment (which may
 * appear both at the start and the end of the meeting) and the educative
 * session's three parts — prepared speeches, table topics, evaluations. Each
 * template item carries its section; the agenda view emits a heading whenever
 * the section changes between consecutive items.
 */
export const agendaSection = pgEnum('agenda_section', ['administrative', 'speeches', 'table_topics', 'evaluations'])

export const agendaTemplateItems = pgTable('agenda_template_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => agendaTemplates.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  itemType: agendaItemType('item_type').notNull().default('item'),
  section: agendaSection('section').notNull().default('administrative'),
  labelEn: text('label_en').notNull(),
  labelFr: text('label_fr').notNull(),
  durationMinutes: integer('duration_minutes'),
  // Optional bound role: the meeting's signed-up holder fills this item.
  meetingRoleId: uuid('meeting_role_id').references(() => meetingRoles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Meeting lifecycle (PRD §6.1): a normal `scheduled` meeting, or one manually
 * `cancelled` (kept on the calendar, struck-through, and skipped in numbering).
 * Holidays delete future meetings outright; cancellation preserves the row. */
export const meetingStatus = pgEnum('meeting_status', ['scheduled', 'cancelled'])

/**
 * A scheduled meeting (PRD §6.1). One per calendar date. Theme/notes are
 * bilingual user content. `templateId` chooses the agenda template to expand.
 * `meetingNumber` is auto-assigned contiguously across non-cancelled meetings
 * in date order (see server/utils/meetings.ts renumberMeetings). Post-meeting
 * minutes live in their own `meeting_minutes` table (structured, single-language).
 */
export const meetings = pgTable('meetings', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: date('date').notNull().unique(),
  meetingNumber: integer('meeting_number'),
  status: meetingStatus('status').notNull().default('scheduled'),
  themeEn: text('theme_en'),
  themeFr: text('theme_fr'),
  location: text('location'),
  notesEn: text('notes_en'),
  notesFr: text('notes_fr'),
  templateId: uuid('template_id').references(() => agendaTemplates.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Holidays / no-meeting exceptions (PRD §6.1): a date + bilingual label. */
export const calendarExceptions = pgTable('calendar_exceptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: date('date').notNull().unique(),
  labelEn: text('label_en').notNull(),
  labelFr: text('label_fr').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Role signups for a meeting (PRD §6.2). A signup is filled by a member
 * (`userId`) OR a guest (`guestName`) — never hard-require an account. One
 * signup per role per meeting; `assignedBy` is null for member self-signup,
 * set when an officer assigns someone.
 */
export const meetingRoleSignups = pgTable('meeting_role_signups', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => meetingRoles.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  guestName: text('guest_name'),
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('meeting_role_unique').on(t.meetingId, t.roleId)])

/**
 * Speeches for a meeting (PRD §6.3). Presenter and evaluator are each a member
 * OR a guest name. `pathwaysProject` is a placeholder field (Phase 2).
 * `minMinutes`/`maxMinutes` are the speech's timing window (default 5–7, from
 * the `speech.default_*_minutes` settings, applied at creation; nullable rows
 * fall back to those settings). The agenda allots `maxMinutes` +
 * `speech.agenda_buffer_minutes` per speech (see server/utils/speeches.ts).
 */
export const speeches = pgTable('speeches', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  slot: integer('slot').notNull().default(1),
  title: text('title'),
  minMinutes: integer('min_minutes'),
  maxMinutes: integer('max_minutes'),
  presenterUserId: uuid('presenter_user_id').references(() => users.id, { onDelete: 'set null' }),
  presenterGuestName: text('presenter_guest_name'),
  pathwaysProject: text('pathways_project'),
  evaluatorUserId: uuid('evaluator_user_id').references(() => users.id, { onDelete: 'set null' }),
  evaluatorGuestName: text('evaluator_guest_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('meeting_speech_slot_unique').on(t.meetingId, t.slot)])

/**
 * Guest check-ins for a meeting (PRD §9). A guest scans the meeting's QR and adds
 * their own name (+ optional email) with no account, or a member adds them on the
 * spot. `addedBy` is null for an anonymous self check-in, set when a logged-in
 * member records the guest. Feeds the member-visible guest list and serves as a
 * pick source so managers assign roles/speeches/vote candidates without retyping
 * the name (the name is reused as a `guestName` everywhere participation is recorded).
 */
export const guestCheckins = pgTable('guest_checkins', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * How a member's presence at a meeting was recorded (issue #35, PRD §9/§11):
 * `self` — the member checked themselves in; `secretary` — a meeting manager /
 * secretary recorded it (e.g. from the minutes). Data-driven authority means we
 * track *who* recorded it (`recordedBy`) rather than hard-coding a "Secretary".
 */
export const attendanceSource = pgEnum('attendance_source', ['self', 'secretary'])

/**
 * Member attendance for a meeting (issue #35, PRD §9 check-in / §11 tracking).
 * The member equivalent of `guest_checkins`: one row per member per meeting marks
 * that they were *present*, independent of taking a role, speaking, or evaluating.
 * Feeds the per-meeting present count (quorum aid for the secretary) and the
 * member-visible participation history. `recordedBy` is null for a self check-in,
 * set to the manager who recorded it; `source` distinguishes the two paths.
 */
export const meetingAttendance = pgTable('meeting_attendance', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  source: attendanceSource('source').notNull().default('self'),
  recordedBy: uuid('recorded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('meeting_attendance_unique').on(t.meetingId, t.userId)])

export type MeetingRole = typeof meetingRoles.$inferSelect
export type NewMeetingRole = typeof meetingRoles.$inferInsert
export type AgendaTemplate = typeof agendaTemplates.$inferSelect
export type AgendaTemplateItem = typeof agendaTemplateItems.$inferSelect
export type Meeting = typeof meetings.$inferSelect
export type CalendarException = typeof calendarExceptions.$inferSelect
export type MeetingRoleSignup = typeof meetingRoleSignups.$inferSelect
export type Speech = typeof speeches.$inferSelect
export type GuestCheckin = typeof guestCheckins.$inferSelect
export type NewGuestCheckin = typeof guestCheckins.$inferInsert
export type MeetingAttendance = typeof meetingAttendance.$inferSelect
export type NewMeetingAttendance = typeof meetingAttendance.$inferInsert

/**
 * Approval status of a meeting's minutes (PRD §6, issue #14). `pending` until a
 * later reviewer (the next meeting's secretary, the president, or admin) approves
 * the minutes as `read` (accepted as written) or `amended` (accepted with the
 * corrections captured in `amendmentNotes`).
 */
export const minutesApprovalStatus = pgEnum('minutes_approval_status', ['pending', 'read', 'amended'])

/**
 * Meeting minutes (PRD §6, issue #14). One record per meeting, authored by the
 * meeting's secretary (or president/admin). DELIBERATELY single-language — the
 * secretary writes in whichever language they choose, so there are NO paired
 * `*_en`/`*_fr` columns here (an explicit exception to the bilingual-content
 * rule, which still governs News and landing content). The body is the five
 * structured sections. Two attestations are recorded: who submitted it
 * (`submittedBy`/`submittedAt`) and who approved it as read/amended
 * (`approvedBy`/`approvedAt` + `approvalStatus`/`amendmentNotes`), the latter
 * captured when a subsequent secretary reviews prior minutes.
 */
export const meetingMinutes = pgTable('meeting_minutes', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }).unique(),
  unfinishedBusiness: text('unfinished_business'),
  newBusiness: text('new_business'),
  upcomingEvents: text('upcoming_events'),
  specialReminders: text('special_reminders'),
  generalEvaluatorMention: text('general_evaluator_mention'),
  // Author attestation: the secretary who submitted the minutes.
  submittedBy: uuid('submitted_by').references(() => users.id, { onDelete: 'set null' }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  // Approval attestation: the reviewer who accepted the minutes as read/amended.
  approvalStatus: minutesApprovalStatus('approval_status').notNull().default('pending'),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  amendmentNotes: text('amendment_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type MeetingMinutes = typeof meetingMinutes.$inferSelect
export type NewMeetingMinutes = typeof meetingMinutes.$inferInsert
