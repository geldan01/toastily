import { and, asc, eq, isNotNull, ne } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Public, curated testimonials (issue #27) for the landing/about pages. Per
 * language: only rows the curator has explicitly featured AND whose body is
 * non-empty, ordered by the curator's `featured_order_<lang>` then by age.
 */
export default defineEventHandler(async () => {
  const db = useDrizzle()

  const en = await db
    .select({
      id: schema.testimonials.id,
      name: schema.users.name,
      avatarKey: schema.users.avatarKey,
      body: schema.testimonials.bodyEn,
    })
    .from(schema.testimonials)
    .innerJoin(schema.users, eq(schema.users.id, schema.testimonials.userId))
    .where(and(
      eq(schema.testimonials.featuredEn, true),
      isNotNull(schema.testimonials.bodyEn),
      ne(schema.testimonials.bodyEn, ''),
    ))
    .orderBy(asc(schema.testimonials.featuredOrderEn), asc(schema.testimonials.createdAt))

  const fr = await db
    .select({
      id: schema.testimonials.id,
      name: schema.users.name,
      avatarKey: schema.users.avatarKey,
      body: schema.testimonials.bodyFr,
    })
    .from(schema.testimonials)
    .innerJoin(schema.users, eq(schema.users.id, schema.testimonials.userId))
    .where(and(
      eq(schema.testimonials.featuredFr, true),
      isNotNull(schema.testimonials.bodyFr),
      ne(schema.testimonials.bodyFr, ''),
    ))
    .orderBy(asc(schema.testimonials.featuredOrderFr), asc(schema.testimonials.createdAt))

  const withAvatar = ({ avatarKey, ...t }: typeof en[number]) => ({
    ...t,
    avatarUrl: avatarKey ? publicUrlForKey(avatarKey) : null,
  })

  return { en: en.map(withAvatar), fr: fr.map(withAvatar) }
})
