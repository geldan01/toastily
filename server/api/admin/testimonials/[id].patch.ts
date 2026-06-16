import { eq, sql } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Feature / un-feature a member's testimonial per language (issue #27).
 * Content-edit gated. Featuring is an explicit curator opt-in: a language can
 * only be enabled when its body is non-empty (422 otherwise), and enabling
 * appends it to the end of that language's featured list (max order + 1).
 * Disabling just clears the flag and leaves the order untouched.
 */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const db = useDrizzle()
  const [row] = await db
    .select()
    .from(schema.testimonials)
    .where(eq(schema.testimonials.id, id))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Testimonial not found.' })

  const patch: Record<string, unknown> = {}

  if (body?.featuredEn !== undefined) {
    if (body.featuredEn) {
      if (!row.bodyEn || !row.bodyEn.trim()) {
        throw createError({ statusCode: 422, statusMessage: 'Cannot feature an empty testimonial.' })
      }
      patch.featuredEn = true
      patch.featuredOrderEn = await nextOrder('featuredOrderEn')
    }
    else {
      patch.featuredEn = false
    }
  }

  if (body?.featuredFr !== undefined) {
    if (body.featuredFr) {
      if (!row.bodyFr || !row.bodyFr.trim()) {
        throw createError({ statusCode: 422, statusMessage: 'Cannot feature an empty testimonial.' })
      }
      patch.featuredFr = true
      patch.featuredOrderFr = await nextOrder('featuredOrderFr')
    }
    else {
      patch.featuredFr = false
    }
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update.' })
  }

  patch.updatedAt = new Date()
  await db.update(schema.testimonials).set(patch).where(eq(schema.testimonials.id, id))

  const [updated] = await db
    .select({
      id: schema.testimonials.id,
      userId: schema.testimonials.userId,
      name: schema.users.name,
      email: schema.users.email,
      bodyEn: schema.testimonials.bodyEn,
      bodyFr: schema.testimonials.bodyFr,
      featuredEn: schema.testimonials.featuredEn,
      featuredFr: schema.testimonials.featuredFr,
      featuredOrderEn: schema.testimonials.featuredOrderEn,
      featuredOrderFr: schema.testimonials.featuredOrderFr,
      updatedAt: schema.testimonials.updatedAt,
    })
    .from(schema.testimonials)
    .innerJoin(schema.users, eq(schema.users.id, schema.testimonials.userId))
    .where(eq(schema.testimonials.id, id))
    .limit(1)

  return { testimonial: updated }

  // Land a newly-featured row at the end of its language's ordered list.
  async function nextOrder(column: 'featuredOrderEn' | 'featuredOrderFr') {
    const [agg] = await db
      .select({ max: sql<number>`coalesce(max(${schema.testimonials[column]}), -1)` })
      .from(schema.testimonials)
    return (agg?.max ?? -1) + 1
  }
})
