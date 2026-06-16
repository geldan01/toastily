import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Content-manager read of a rich page for editing (issue #16): returns the
 * full row including drafts, or `{ page: null }` when it doesn't exist yet
 * (the editor then starts blank and the PUT creates it). Content-edit gated.
 */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)
  const slug = getRouterParam(event, 'slug')
  if (!isPageSlug(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  const rows = await useDrizzle()
    .select()
    .from(schema.pages)
    .where(eq(schema.pages.slug, slug))
    .limit(1)

  return { page: rows[0] ?? null }
})
