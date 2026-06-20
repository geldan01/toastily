import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Enroll the current member in a Pathways path (issue #58). Self-tracked: a
 * member manages their own enrollments only. One enrollment per path per member
 * (unique constraint → 409 on a duplicate). `makeCurrent` flags it as the path
 * the member is actively working, clearing the flag on their other enrollments
 * (a member works one current path at a time).
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const body = await readBody(event)
  const pathId = String(body?.pathId ?? '')
  if (!pathId) throw createError({ statusCode: 400, statusMessage: 'pathId is required.' })
  const makeCurrent = body?.makeCurrent !== false // default to current

  const db = useDrizzle()
  const [path] = await db.select({ id: schema.pathwaysPaths.id, active: schema.pathwaysPaths.active })
    .from(schema.pathwaysPaths).where(eq(schema.pathwaysPaths.id, pathId)).limit(1)
  if (!path || !path.active) throw createError({ statusCode: 404, statusMessage: 'Path not found.' })

  const [existing] = await db.select({ id: schema.memberPathways.id })
    .from(schema.memberPathways)
    .where(and(eq(schema.memberPathways.userId, user.id), eq(schema.memberPathways.pathId, pathId)))
    .limit(1)
  if (existing) throw createError({ statusCode: 409, statusMessage: 'You are already enrolled in this path.' })

  if (makeCurrent) {
    await db.update(schema.memberPathways)
      .set({ isCurrent: false })
      .where(eq(schema.memberPathways.userId, user.id))
  }

  const startedAt = body?.startedAt ? String(body.startedAt) : null
  const [row] = await db.insert(schema.memberPathways)
    .values({ userId: user.id, pathId, isCurrent: makeCurrent, startedAt })
    .returning()
  return { enrollment: row }
})
