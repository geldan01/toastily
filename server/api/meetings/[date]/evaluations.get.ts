import { asc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { schema, useDrizzle } from '../../../db/client'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Data for the written-evaluations page (issue #60). PUBLIC — guests evaluate too.
 * Returns the meeting's evaluable speeches (those with a speaker), and, for a
 * logged-in member, whether they are checked in (`selfEligible`) plus the
 * evaluations they have already left (`mine`, keyed by speechId) so the form
 * pre-fills. Guests identify by the name they checked in with at submit time, so
 * no per-guest state is returned here.
 */
export default defineEventHandler(async (event) => {
  const date = getRouterParam(event, 'date')!
  if (!DATE_RE.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Date must be YYYY-MM-DD.' })
  }
  const db = useDrizzle()
  const [meeting] = await db.select({ id: schema.meetings.id })
    .from(schema.meetings).where(eq(schema.meetings.date, date)).limit(1)
  if (!meeting) {
    return { meetingId: null, speeches: [], selfEligible: false, mine: {} as Record<string, unknown> }
  }

  // Only speeches that actually have a speaker can be evaluated.
  const speaker = alias(schema.users, 'speaker')
  const rows = await db.select({
    id: schema.speeches.id,
    slot: schema.speeches.slot,
    title: schema.speeches.title,
    presenterUserId: schema.speeches.presenterUserId,
    presenterGuestName: schema.speeches.presenterGuestName,
    speakerName: speaker.name,
  })
    .from(schema.speeches)
    .leftJoin(speaker, eq(speaker.id, schema.speeches.presenterUserId))
    .where(eq(schema.speeches.meetingId, meeting.id))
    .orderBy(asc(schema.speeches.slot))

  const speeches = rows
    .filter(s => s.presenterUserId || s.presenterGuestName)
    .map(s => ({
      id: s.id,
      slot: s.slot,
      title: s.title,
      speakerName: s.presenterUserId ? s.speakerName : s.presenterGuestName,
      speakerUserId: s.presenterUserId,
      speakerIsGuest: !s.presenterUserId,
    }))

  const user = await getCurrentUser(event)
  const asMember = !!user && hasMinRole(user.status, 'member')
  let selfEligible = false
  const mine: Record<string, unknown> = {}
  if (asMember) {
    selfEligible = await isCheckedIn(db, meeting.id, { userId: user!.id })
    const own = await db.select({
      id: schema.writtenEvaluations.id,
      speechId: schema.writtenEvaluations.speechId,
      liked: schema.writtenEvaluations.liked,
      recommend: schema.writtenEvaluations.recommend,
      structureRating: schema.writtenEvaluations.structureRating,
      vocalVarietyRating: schema.writtenEvaluations.vocalVarietyRating,
      gesturesRating: schema.writtenEvaluations.gesturesRating,
    })
      .from(schema.writtenEvaluations)
      .where(eq(schema.writtenEvaluations.evaluatorUserId, user!.id))
    for (const e of own) {
      if (speeches.some(s => s.id === e.speechId)) mine[e.speechId] = e
    }
  }

  return { meetingId: meeting.id, speeches, selfEligible, mine }
})
