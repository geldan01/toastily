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

export const agendaTemplateItems = pgTable('agenda_template_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => agendaTemplates.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  itemType: agendaItemType('item_type').notNull().default('item'),
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
 * in date order (see server/utils/meetings.ts renumberMeetings). `minutes_*`
 * hold the post-meeting minutes (entered later).
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
  minutesEn: text('minutes_en'),
  minutesFr: text('minutes_fr'),
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
