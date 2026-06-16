import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Save the current member's testimonial (issue #27). Bodies are independent
 * free text per language; trimmed empties become null. Because featured
 * testimonials are curator-approved for public display, any change to a body
 * (including clearing it) resets that language's featured flag/order — the
 * curator must re-approve the new text. Upsert keyed by the unique userId.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const body = await readBody(event)

  const bodyEn = String(body?.bodyEn ?? '').trim() || null
  const bodyFr = String(body?.bodyFr ?? '').trim() || null

  const db = useDrizzle()
  const [existing] = await db
    .select()
    .from(schema.testimonials)
    .where(eq(schema.testimonials.userId, user.id))
    .limit(1)

  const now = new Date()

  if (!existing) {
    await db.insert(schema.testimonials).values({
      userId: user.id,
      bodyEn,
      bodyFr,
      updatedAt: now,
    })
    return { bodyEn, bodyFr, featuredEn: false, featuredFr: false }
  }

  // Changing (or clearing) a body voids that language's curator approval.
  const enChanged = bodyEn !== existing.bodyEn
  const frChanged = bodyFr !== existing.bodyFr

  const set: Record<string, unknown> = { bodyEn, bodyFr, updatedAt: now }
  if (enChanged) {
    set.featuredEn = false
    set.featuredOrderEn = 0
  }
  if (frChanged) {
    set.featuredFr = false
    set.featuredOrderFr = 0
  }

  await db.update(schema.testimonials).set(set).where(eq(schema.testimonials.userId, user.id))

  return {
    bodyEn,
    bodyFr,
    featuredEn: enChanged ? false : existing.featuredEn,
    featuredFr: frChanged ? false : existing.featuredFr,
  }
})
