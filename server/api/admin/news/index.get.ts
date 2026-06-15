import { desc } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * List every news article — drafts included — for the authoring UI (issue #12).
 * Gated by the content-edit capability. Newest first by creation; the list view
 * omits the full body.
 */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)
  const rows = await useDrizzle()
    .select({
      id: schema.news.id,
      titleEn: schema.news.titleEn,
      titleFr: schema.news.titleFr,
      excerptEn: schema.news.excerptEn,
      excerptFr: schema.news.excerptFr,
      image: schema.news.image,
      publishedAt: schema.news.publishedAt,
      createdAt: schema.news.createdAt,
    })
    .from(schema.news)
    .orderBy(desc(schema.news.createdAt))
  return { news: rows }
})
