import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../../db/client'

/** Unpublish a news article — revert it to a draft (issue #12). Content-edit gated. */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)
  const id = getRouterParam(event, 'id')!

  const [row] = await useDrizzle()
    .update(schema.news)
    .set({ publishedAt: null })
    .where(eq(schema.news.id, id))
    .returning()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Article not found.' })
  return { article: row }
})
