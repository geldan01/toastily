import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Member testimonials (issue #27). One row per member (unique user_id). EN and
 * FR bodies are INDEPENDENT free text (PRD §12 pairing applies for display, but
 * a member is NOT required to provide both languages). Featuring for public
 * display is per-language and curator-driven: `featured_en` / `featured_fr`
 * each carry their own ordering. A language can only be featured when its body
 * is non-empty (enforced in the curation API). Editing a body resets that
 * language's featured flag so the curator must re-approve the changed text.
 */
export const testimonials = pgTable('testimonials', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  bodyEn: text('body_en'),
  bodyFr: text('body_fr'),
  featuredEn: boolean('featured_en').notNull().default(false),
  featuredFr: boolean('featured_fr').notNull().default(false),
  featuredOrderEn: integer('featured_order_en').notNull().default(0),
  featuredOrderFr: integer('featured_order_fr').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Testimonial = typeof testimonials.$inferSelect
export type NewTestimonial = typeof testimonials.$inferInsert
