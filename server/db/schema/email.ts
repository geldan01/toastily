import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Member notifications & scheduled emails (PRD §10). Templates, schedules, and a
 * send log are all DB-managed so club copy and cadence are configured per
 * deployment — never hard-coded. The flagship template is the weekly
 * "unfilled roles" reminder, but the system is template-keyed and extensible.
 */

/**
 * A managed email template, keyed by a stable `key` (e.g. `unfilled_roles`).
 * Subject and body are bilingual; the body supports placeholders substituted at
 * send time ({{intro}}, {{unfilled_roles}}, {{signup_link}}, {{outro}}).
 */
export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  descriptionEn: text('description_en'),
  descriptionFr: text('description_fr'),
  subjectEn: text('subject_en').notNull(),
  subjectFr: text('subject_fr').notNull(),
  bodyEn: text('body_en').notNull(),
  bodyFr: text('body_fr').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Send cadence (PRD §10). Weekly is the v1 cadence; extensible later. */
export const emailCadence = pgEnum('email_cadence', ['weekly'])

/**
 * A recurring schedule that fires a template (PRD §10). Multiple schedules may
 * exist. `dayOfWeek` is 0–6 (Sunday=0); `timeOfDay` is "HH:MM" (server local).
 * `lastRunAt` guards against double-firing within a cadence window.
 */
export const emailSchedules = pgTable('email_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateKey: text('template_key').notNull().references(() => emailTemplates.key, { onDelete: 'cascade' }),
  cadence: emailCadence('cadence').notNull().default('weekly'),
  dayOfWeek: integer('day_of_week').notNull().default(0),
  timeOfDay: text('time_of_day').notNull().default('09:00'),
  active: boolean('active').notNull().default(true),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** How a send was triggered (PRD §10). */
export const emailTrigger = pgEnum('email_trigger', ['manual', 'scheduled'])

/** Outcome of a send attempt — recorded for the history log (PRD §10). */
export const emailSendStatus = pgEnum('email_send_status', ['sent', 'stubbed', 'failed'])

/**
 * Append-only send history (PRD §10): when, which template, how triggered, who
 * triggered it (null for scheduled), how many recipients, and the outcome.
 */
export const emailSendLog = pgTable('email_send_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateKey: text('template_key').notNull(),
  trigger: emailTrigger('trigger').notNull(),
  status: emailSendStatus('status').notNull(),
  recipientCount: integer('recipient_count').notNull().default(0),
  triggeredBy: uuid('triggered_by').references(() => users.id, { onDelete: 'set null' }),
  error: text('error'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
})

export type EmailTemplate = typeof emailTemplates.$inferSelect
export type NewEmailTemplate = typeof emailTemplates.$inferInsert
export type EmailSchedule = typeof emailSchedules.$inferSelect
export type NewEmailSchedule = typeof emailSchedules.$inferInsert
export type EmailSendLog = typeof emailSendLog.$inferSelect
