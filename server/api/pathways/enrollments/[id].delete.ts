import { and, eq, isNotNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Remove one of the current member's enrollments (issue #58) and its projects
 * (cascade). Self-tracked — only the member's own enrollment. Any speeches its
 * projects had linked have their mirrored `pathways_project` label cleared first
 * (the cascade would otherwise drop the project rows and orphan the labels).
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Enrollment id is required.' })

  const db = useDrizzle()
  await requireOwnEnrollment(db, id, user.id)

  // Clear the mirrored labels on any speeches these projects linked.
  const linked = await db.select({ speechId: schema.memberPathwayProjects.speechId })
    .from(schema.memberPathwayProjects)
    .where(and(eq(schema.memberPathwayProjects.enrollmentId, id), isNotNull(schema.memberPathwayProjects.speechId)))
  for (const { speechId } of linked) {
    if (speechId) await syncSpeechPathwaysLabel(db, { newSpeechId: null, previousSpeechId: speechId, title: null })
  }

  await db.delete(schema.memberPathways).where(eq(schema.memberPathways.id, id))
  return { ok: true }
})
