import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Fetch a single article (drafts included) for editing. Content-edit gated. */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const [row] = await useDrizzle()
    .select()
    .from(schema.news)
    .where(eq(schema.news.id, id))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  return { article: row }
})
