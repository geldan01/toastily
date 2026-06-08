import { and, eq, isNotNull, lte } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/** A single published news article by id. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const rows = await useDrizzle()
    .select()
    .from(schema.news)
    .where(and(
      eq(schema.news.id, id),
      isNotNull(schema.news.publishedAt),
      lte(schema.news.publishedAt, new Date()),
    ))
    .limit(1)

  if (!rows[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }
  return rows[0]
})
