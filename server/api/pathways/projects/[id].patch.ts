import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Edit a self-reported project (issue #58): its level, title, completion date,
 * or linked speech. Self-tracked — the project must belong to one of the
 * member's own enrollments. When the linked speech or title changes, the
 * mirrored `pathways_project` label is moved/updated (old speech cleared).
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Project id is required.' })

  const db = useDrizzle()
  // The project must belong to an enrollment the member owns.
  const [project] = await db.select({
    id: schema.memberPathwayProjects.id,
    enrollmentId: schema.memberPathwayProjects.enrollmentId,
    title: schema.memberPathwayProjects.title,
    speechId: schema.memberPathwayProjects.speechId,
  })
    .from(schema.memberPathwayProjects)
    .where(eq(schema.memberPathwayProjects.id, id))
    .limit(1)
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found.' })
  await requireOwnEnrollment(db, project.enrollmentId, user.id)

  const body = await readBody(event)
  const updates: Record<string, unknown> = {}
  if (body?.level !== undefined) {
    const level = Number(body.level)
    if (!isValidLevel(level)) throw createError({ statusCode: 400, statusMessage: 'Level must be a whole number from 1 to 5.' })
    updates.level = level
  }
  if (body?.title !== undefined) {
    const title = String(body.title).trim()
    if (!title) throw createError({ statusCode: 400, statusMessage: 'A project title is required.' })
    updates.title = title
  }
  if (body?.completedAt !== undefined) updates.completedAt = body.completedAt ? String(body.completedAt) : null

  // Speech link: undefined ⇒ leave as is; null/'' ⇒ unlink; else relink (own speech).
  let newSpeechId = project.speechId
  if (body?.speechId !== undefined) {
    newSpeechId = await resolveLinkedSpeech(db, body.speechId ? String(body.speechId) : null, user.id)
    updates.speechId = newSpeechId
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update.' })
  }

  const [row] = await db.update(schema.memberPathwayProjects)
    .set(updates)
    .where(eq(schema.memberPathwayProjects.id, id))
    .returning()

  await syncSpeechPathwaysLabel(db, {
    previousSpeechId: project.speechId,
    newSpeechId,
    title: (updates.title as string | undefined) ?? project.title,
  })
  return { project: row }
})
