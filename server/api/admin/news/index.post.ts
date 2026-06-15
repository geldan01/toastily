import { schema, useDrizzle } from '../../../db/client'

/**
 * Create a news draft (issue #12). Gated by the content-edit capability.
 * All content fields are optional here — a draft starts blank and is filled in
 * the editor; the both-locales requirement is enforced only at publish time
 * (`assertPublishable`). The current user is recorded as author.
 */
export default defineEventHandler(async (event) => {
  const user = await requireContentManager(event)
  const body = await readBody(event).catch(() => ({}))

  const [row] = await useDrizzle()
    .insert(schema.news)
    .values({
      titleEn: String(body?.titleEn ?? '').trim(),
      titleFr: String(body?.titleFr ?? '').trim(),
      contentEn: typeof body?.contentEn === 'string' ? body.contentEn : '',
      contentFr: typeof body?.contentFr === 'string' ? body.contentFr : '',
      excerptEn: body?.excerptEn ? String(body.excerptEn) : null,
      excerptFr: body?.excerptFr ? String(body.excerptFr) : null,
      image: body?.image ? String(body.image) : null,
      authorId: user.id,
    })
    .returning()

  return { article: row }
})
