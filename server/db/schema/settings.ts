import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Key/value club configuration (PRD §2.2). Holds ALL club-specific and
 * sensitive values — club name/contact, meeting place/time, default locale,
 * branding accents, Resend config, QR target URL, max speeches, etc.
 *
 * `isAdminOnly` rows (e.g. Resend API key) are never exposed to the public
 * settings endpoint. Seed data ships generic; real club values are applied via
 * a deployment-only seed/migration, never committed to this public repo.
 */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  isAdminOnly: boolean('is_admin_only').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert
