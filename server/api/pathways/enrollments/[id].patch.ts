import { and, eq, ne } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Update one of the current member's enrollments (issue #58): mark it current,
 * set/clear the started or completed date. Self-tracked — only the member's own
 * enrollment (ownership enforced by requireOwnEnrollment). Setting `isCurrent`
 * true clears the flag on the member's other enrollments.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Enrollment id is required.' })

  const body = await readBody(event)
  const db = useDrizzle()
  await requireOwnEnrollment(db, id, user.id)

  const updates: Record<string, unknown> = {}
  if (body?.isCurrent !== undefined) updates.isCurrent = !!body.isCurrent
  if (body?.startedAt !== undefined) updates.startedAt = body.startedAt ? String(body.startedAt) : null
  if (body?.completedAt !== undefined) updates.completedAt = body.completedAt ? String(body.completedAt) : null
  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update.' })
  }

  if (updates.isCurrent === true) {
    await db.update(schema.memberPathways)
      .set({ isCurrent: false })
      .where(and(eq(schema.memberPathways.userId, user.id), ne(schema.memberPathways.id, id)))
  }

  const [row] = await db.update(schema.memberPathways)
    .set(updates)
    .where(eq(schema.memberPathways.id, id))
    .returning()
  return { enrollment: row }
})
