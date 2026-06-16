import { and, asc, eq, isNotNull, ne, or } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Curation list of member testimonials (issue #27). Content-edit gated. Shows
 * every member who has written at least one language, with both bodies and the
 * per-language feature flags/order so the curator can review and feature them.
 */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)

  const testimonials = await useDrizzle()
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
    .where(or(
      and(isNotNull(schema.testimonials.bodyEn), ne(schema.testimonials.bodyEn, '')),
      and(isNotNull(schema.testimonials.bodyFr), ne(schema.testimonials.bodyFr, '')),
    ))
    .orderBy(asc(schema.users.name))

  return { testimonials }
})
