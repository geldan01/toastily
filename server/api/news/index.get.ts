import { and, desc, isNotNull, lte } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/** Published news, newest first (list view — no full body). */
export default defineEventHandler(async () => {
  return await useDrizzle()
    .select({
      id: schema.news.id,
      titleEn: schema.news.titleEn,
      titleFr: schema.news.titleFr,
      excerptEn: schema.news.excerptEn,
      excerptFr: schema.news.excerptFr,
      image: schema.news.image,
      publishedAt: schema.news.publishedAt,
    })
    .from(schema.news)
    .where(and(isNotNull(schema.news.publishedAt), lte(schema.news.publishedAt, new Date())))
    .orderBy(desc(schema.news.publishedAt))
})
