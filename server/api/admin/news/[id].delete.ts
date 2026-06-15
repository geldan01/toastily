import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Delete a news article (issue #12). Content-edit gated. */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)
  const id = getRouterParam(event, 'id')!

  const [row] = await useDrizzle()
    .delete(schema.news)
    .where(eq(schema.news.id, id))
    .returning({ id: schema.news.id })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Article not found.' })
  return { ok: true }
})
