import { schema, useDrizzle } from '../../../db/client'

/**
 * Add a self-reported completed project to one of the current member's
 * enrollments (issue #58). Self-tracked — the enrollment must be the member's
 * own. `level` is 1–5, `title` free text. An optional `speechId` ties the project
 * to a club speech the member delivered, mirroring the title into the speech's
 * existing `pathways_project` placeholder.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const body = await readBody(event)

  const enrollmentId = String(body?.enrollmentId ?? '')
  if (!enrollmentId) throw createError({ statusCode: 400, statusMessage: 'enrollmentId is required.' })
  const level = Number(body?.level)
  if (!isValidLevel(level)) throw createError({ statusCode: 400, statusMessage: 'Level must be a whole number from 1 to 5.' })
  const title = String(body?.title ?? '').trim()
  if (!title) throw createError({ statusCode: 400, statusMessage: 'A project title is required.' })
  const completedAt = body?.completedAt ? String(body.completedAt) : null

  const db = useDrizzle()
  await requireOwnEnrollment(db, enrollmentId, user.id)
  const speechId = await resolveLinkedSpeech(db, body?.speechId ? String(body.speechId) : null, user.id)

  const [row] = await db.insert(schema.memberPathwayProjects)
    .values({ enrollmentId, level, title, completedAt, speechId })
    .returning()

  await syncSpeechPathwaysLabel(db, { newSpeechId: speechId, title })
  return { project: row }
})
