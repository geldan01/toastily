import { and, asc, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/** Published content blocks for a page, ordered by section then sort order. */
export default defineEventHandler(async (event) => {
  const page = getRouterParam(event, 'page')
  if (!page) {
    throw createError({ statusCode: 400, statusMessage: 'Missing page' })
  }

  return await useDrizzle()
    .select()
    .from(schema.contentBlocks)
    .where(and(
      eq(schema.contentBlocks.page, page),
      eq(schema.contentBlocks.published, true),
    ))
    .orderBy(asc(schema.contentBlocks.section), asc(schema.contentBlocks.sortOrder))
})
