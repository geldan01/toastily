import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Remove a self-reported project (issue #58). Self-tracked — the project must
 * belong to one of the member's own enrollments. Clears the mirrored
 * `pathways_project` label on any speech it had linked.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Project id is required.' })

  const db = useDrizzle()
  const [project] = await db.select({
    id: schema.memberPathwayProjects.id,
    enrollmentId: schema.memberPathwayProjects.enrollmentId,
    speechId: schema.memberPathwayProjects.speechId,
  })
    .from(schema.memberPathwayProjects)
    .where(eq(schema.memberPathwayProjects.id, id))
    .limit(1)
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found.' })
  await requireOwnEnrollment(db, project.enrollmentId, user.id)

  await db.delete(schema.memberPathwayProjects).where(eq(schema.memberPathwayProjects.id, id))
  if (project.speechId) {
    await syncSpeechPathwaysLabel(db, { previousSpeechId: project.speechId, newSpeechId: null, title: null })
  }
  return { ok: true }
})
