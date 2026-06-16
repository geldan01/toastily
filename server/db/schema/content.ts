import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Editable landing/page content (PRD §5.1). Each row is one section item
 * (a hero slide, a benefit pillar, a why-join point…) keyed by page+section.
 * Bilingual user content uses paired *_en / *_fr columns (PRD §12): both are
 * required before a block may be published.
 */
export const contentBlocks = pgTable('content_blocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  page: text('page').notNull(), // e.g. 'home'
  section: text('section').notNull(), // e.g. 'hero', 'benefit', 'why_join'
  titleEn: text('title_en'),
  titleFr: text('title_fr'),
  bodyEn: text('body_en'),
  bodyFr: text('body_fr'),
  image: text('image'),
  ctaLabelEn: text('cta_label_en'),
  ctaLabelFr: text('cta_label_fr'),
  ctaHref: text('cta_href'),
  sortOrder: integer('sort_order').notNull().default(0),
  published: boolean('published').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * News articles (PRD §5.3). Dual EN+FR title/content required to publish.
 * `publishedAt` null ⇒ draft. Landing shows the latest 3 published.
 */
export const news = pgTable('news', {
  id: uuid('id').defaultRandom().primaryKey(),
  titleEn: text('title_en').notNull(),
  titleFr: text('title_fr').notNull(),
  contentEn: text('content_en').notNull(),
  contentFr: text('content_fr').notNull(),
  excerptEn: text('excerpt_en'),
  excerptFr: text('excerpt_fr'),
  image: text('image'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Standalone rich pages (issue #16, PRD §5.2): About / FAQ. Unlike the keyed
 * `content_blocks` (section snippets), each row is one full page authored in
 * Editor.js — `content_*` hold the block JSON. Public-readable when published;
 * editable only by content managers. Bilingual: both locales required to
 * publish (paired *_en / *_fr columns, PRD §12). `slug` is the route key
 * ('about', 'faq'); the allowed set lives in server/utils/pages.ts.
 */
export const pages = pgTable('pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  titleEn: text('title_en'),
  titleFr: text('title_fr'),
  contentEn: text('content_en'),
  contentFr: text('content_fr'),
  published: boolean('published').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
})

export type ContentBlock = typeof contentBlocks.$inferSelect
export type NewContentBlock = typeof contentBlocks.$inferInsert
export type News = typeof news.$inferSelect
export type NewNews = typeof news.$inferInsert
export type Page = typeof pages.$inferSelect
export type NewPage = typeof pages.$inferInsert
