import { and, eq, sql } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Submit (or update) a written evaluation of a speech (issue #60). PUBLIC — peer
 * feedback from the room: anyone *checked in* may evaluate, a member (via their
 * session) or a checked-in guest (via the name they checked in with). The form is
 * "what you liked" + "what you recommend" (optional free text) and three 1–5 star
 * ratings (structure / vocal variety / gestures). One evaluation per evaluator per
 * speech — re-submitting updates the existing row (editable correction).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const speechId = String(body?.speechId ?? '')
  if (!speechId) throw createError({ statusCode: 400, statusMessage: 'speechId is required.' })

  const structureRating = Number(body?.structureRating)
  const vocalVarietyRating = Number(body?.vocalVarietyRating)
  const gesturesRating = Number(body?.gesturesRating)
  if (![structureRating, vocalVarietyRating, gesturesRating].every(isValidRating)) {
    throw createError({ statusCode: 400, statusMessage: 'Each rating must be a whole number from 1 to 5.' })
  }
  const liked = body?.liked != null ? String(body.liked).trim() || null : null
  const recommend = body?.recommend != null ? String(body.recommend).trim() || null : null

  const db = useDrizzle()
  const [speech] = await db.select({
    id: schema.speeches.id,
    meetingId: schema.speeches.meetingId,
    presenterUserId: schema.speeches.presenterUserId,
    presenterGuestName: schema.speeches.presenterGuestName,
  })
    .from(schema.speeches).where(eq(schema.speeches.id, speechId)).limit(1)
  if (!speech) throw createError({ statusCode: 404, statusMessage: 'Speech not found.' })
  if (!speech.presenterUserId && !speech.presenterGuestName) {
    throw createError({ statusCode: 409, statusMessage: 'This speech has no speaker to evaluate.' })
  }

  // Identity: a logged-in member evaluates as themselves; everyone else must give
  // the name they checked in with. Either way they must be checked in.
  const user = await getCurrentUser(event)
  const asMember = !!user && hasMinRole(user.status, 'member')

  if (asMember) {
    if (speech.presenterUserId === user!.id) {
      throw createError({ statusCode: 409, statusMessage: 'You cannot evaluate your own speech.' })
    }
    if (!(await isCheckedIn(db, speech.meetingId, { userId: user!.id }))) {
      throw createError({ statusCode: 403, statusMessage: 'Check in to this meeting before leaving an evaluation.' })
    }
    const [row] = await db.insert(schema.writtenEvaluations)
      .values({
        meetingId: speech.meetingId,
        speechId,
        evaluatorUserId: user!.id,
        liked,
        recommend,
        structureRating,
        vocalVarietyRating,
        gesturesRating,
      })
      .onConflictDoUpdate({
        target: [schema.writtenEvaluations.speechId, schema.writtenEvaluations.evaluatorUserId],
        set: { liked, recommend, structureRating, vocalVarietyRating, gesturesRating, updatedAt: new Date() },
      })
      .returning()
    return { evaluation: row }
  }

  // Guest path: name required and must match a check-in (case-insensitive).
  const guestName = String(body?.guestName ?? '').trim()
  if (!guestName) throw createError({ statusCode: 400, statusMessage: 'Enter the name you checked in with.' })
  if (!(await isCheckedIn(db, speech.meetingId, { guestName }))) {
    throw createError({ statusCode: 403, statusMessage: 'Check in to this meeting before leaving an evaluation.' })
  }

  // Guests have no stable id, so dedup their re-submits by case-insensitive name.
  const [existing] = await db.select({ id: schema.writtenEvaluations.id })
    .from(schema.writtenEvaluations)
    .where(and(
      eq(schema.writtenEvaluations.speechId, speechId),
      sql`lower(${schema.writtenEvaluations.evaluatorGuestName}) = ${guestName.toLowerCase()}`,
    ))
    .limit(1)

  if (existing) {
    const [row] = await db.update(schema.writtenEvaluations)
      .set({ liked, recommend, structureRating, vocalVarietyRating, gesturesRating, updatedAt: new Date() })
      .where(eq(schema.writtenEvaluations.id, existing.id))
      .returning()
    return { evaluation: row }
  }
  const [row] = await db.insert(schema.writtenEvaluations)
    .values({
      meetingId: speech.meetingId,
      speechId,
      evaluatorGuestName: guestName,
      liked,
      recommend,
      structureRating,
      vocalVarietyRating,
      gesturesRating,
    })
    .returning()
  return { evaluation: row }
})
