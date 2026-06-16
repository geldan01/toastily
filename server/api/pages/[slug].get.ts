import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Public read of a standalone rich page (issue #16): About / FAQ.
 * Anyone can read; only the published row is returned. Returns
 * `{ page: null }` when the slug isn't published yet (the route still
 * renders an empty state + an editor entry for content managers), rather
 * than 404-ing — the page exists conceptually even before it's filled in.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!isPageSlug(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  const rows = await useDrizzle()
    .select({
      slug: schema.pages.slug,
      titleEn: schema.pages.titleEn,
      titleFr: schema.pages.titleFr,
      contentEn: schema.pages.contentEn,
      contentFr: schema.pages.contentFr,
      updatedAt: schema.pages.updatedAt,
    })
    .from(schema.pages)
    .where(and(eq(schema.pages.slug, slug), eq(schema.pages.published, true)))
    .limit(1)

  return { page: rows[0] ?? null }
})
