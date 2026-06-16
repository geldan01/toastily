import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * The current member's own testimonial (issue #27). Returns the editable EN/FR
 * bodies plus whether each language is currently featured for public display.
 * No row yet ⇒ a blank, un-featured shape so the editor can render cleanly.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')

  const [row] = await useDrizzle()
    .select({
      bodyEn: schema.testimonials.bodyEn,
      bodyFr: schema.testimonials.bodyFr,
      featuredEn: schema.testimonials.featuredEn,
      featuredFr: schema.testimonials.featuredFr,
    })
    .from(schema.testimonials)
    .where(eq(schema.testimonials.userId, user.id))
    .limit(1)

  return row ?? { bodyEn: null, bodyFr: null, featuredEn: false, featuredFr: false }
})
