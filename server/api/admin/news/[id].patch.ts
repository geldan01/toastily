import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Update a news article's bilingual title/content/excerpt and image (issue #12).
 * Content-edit gated. Saving never publishes; use the publish endpoint for that.
 * Only provided fields are written, so the editor can autosave partial drafts.
 */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const patch: Record<string, unknown> = {}
  if (body?.titleEn !== undefined) patch.titleEn = String(body.titleEn).trim()
  if (body?.titleFr !== undefined) patch.titleFr = String(body.titleFr).trim()
  if (body?.contentEn !== undefined) patch.contentEn = typeof body.contentEn === 'string' ? body.contentEn : ''
  if (body?.contentFr !== undefined) patch.contentFr = typeof body.contentFr === 'string' ? body.contentFr : ''
  if (body?.excerptEn !== undefined) patch.excerptEn = body.excerptEn ? String(body.excerptEn) : null
  if (body?.excerptFr !== undefined) patch.excerptFr = body.excerptFr ? String(body.excerptFr) : null
  if (body?.image !== undefined) patch.image = body.image ? String(body.image) : null

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update.' })
  }

  const [row] = await useDrizzle()
    .update(schema.news)
    .set(patch)
    .where(eq(schema.news.id, id))
    .returning()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Article not found.' })
  return { article: row }
})
