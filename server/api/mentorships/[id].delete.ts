import { and, eq, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * End a mentorship pairing (PRD §11, issue #62). Gated on the people-group
 * capability via `requirePeopleManager`. Soft end — sets `endedAt` so the
 * pairing stays in history ("history is first-class"); a no-op on an
 * already-ended pairing. 404 when the id is unknown.
 */
export default defineEventHandler(async (event) => {
  await requirePeopleManager(event)

  const id = getRouterParam(event, 'id')!
  if (!UUID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid mentorship id.' })
  }

  const db = useDrizzle()
  const updated = await db.update(schema.mentorships)
    .set({ endedAt: new Date() })
    .where(and(eq(schema.mentorships.id, id), isNull(schema.mentorships.endedAt)))
    .returning({ id: schema.mentorships.id })

  if (!updated.length) {
    // Either unknown or already ended — distinguish so the UI knows it's gone.
    const [existing] = await db.select({ id: schema.mentorships.id })
      .from(schema.mentorships)
      .where(eq(schema.mentorships.id, id))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Mentorship not found.' })
  }

  return { ok: true }
})
