import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../../db/client'

/**
 * Publish a news article (issue #12, PRD §12). Content-edit gated. Blocks with
 * 422 unless BOTH locales carry a title and non-empty content. Sets
 * `publishedAt` to now (idempotent re-publish keeps the existing timestamp).
 */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)
  const id = getRouterParam(event, 'id')!
  const db = useDrizzle()

  const [row] = await db.select().from(schema.news).where(eq(schema.news.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Article not found.' })

  assertPublishable(row)

  const [updated] = await db
    .update(schema.news)
    .set({ publishedAt: row.publishedAt ?? new Date() })
    .where(eq(schema.news.id, id))
    .returning()
  return { article: updated }
})
