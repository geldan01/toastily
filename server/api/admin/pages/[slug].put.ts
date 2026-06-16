import { schema, useDrizzle } from '../../../db/client'

/**
 * Create or update a rich page (issue #16). Content-edit gated. A single
 * upsert keyed by slug carries the bilingual title/Editor.js content and the
 * `published` flag. Publishing is validated server-side: both locales must
 * have a title AND non-empty content (PRD §12) or it throws 422.
 */
export default defineEventHandler(async (event) => {
  const user = await requireContentManager(event)
  const slug = getRouterParam(event, 'slug')
  if (!isPageSlug(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  const body = await readBody(event).catch(() => ({}))
  const values = {
    titleEn: String(body?.titleEn ?? '').trim() || null,
    titleFr: String(body?.titleFr ?? '').trim() || null,
    contentEn: typeof body?.contentEn === 'string' ? body.contentEn : '',
    contentFr: typeof body?.contentFr === 'string' ? body.contentFr : '',
    published: Boolean(body?.published),
  }

  // Can't publish a half-filled page — enforce both locales complete first.
  if (values.published) assertPagePublishable(values)

  const [row] = await useDrizzle()
    .insert(schema.pages)
    .values({ slug, ...values, updatedBy: user.id, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.pages.slug,
      set: { ...values, updatedBy: user.id, updatedAt: new Date() },
    })
    .returning()

  return { page: row }
})
