import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Persist the curator's ordering of featured testimonials for one language
 * (issue #27). Content-edit gated. `featuredOrder<Lang>` = position in `ids`.
 */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)
  const body = await readBody(event)

  const locale = body?.locale
  if (locale !== 'en' && locale !== 'fr') {
    throw createError({ statusCode: 400, statusMessage: 'locale must be "en" or "fr".' })
  }
  const ids = body?.ids
  if (!Array.isArray(ids) || ids.some((i: unknown) => typeof i !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'Expected { ids: string[] }' })
  }

  const db = useDrizzle()
  for (let i = 0; i < ids.length; i++) {
    const set = locale === 'en' ? { featuredOrderEn: i } : { featuredOrderFr: i }
    await db.update(schema.testimonials).set(set).where(eq(schema.testimonials.id, ids[i]))
  }
  return { ok: true }
})
