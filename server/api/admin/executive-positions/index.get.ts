import { and, asc, eq, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** Executive positions with their current holder, for the admin editor (PRD §3.2). */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'officer')
  const db = useDrizzle()

  const rows = await db.select({
    id: schema.executivePositions.id,
    nameEn: schema.executivePositions.nameEn,
    nameFr: schema.executivePositions.nameFr,
    canManageCalendar: schema.executivePositions.canManageCalendar,
    canManageContent: schema.executivePositions.canManageContent,
    canAssignOfficers: schema.executivePositions.canAssignOfficers,
    active: schema.executivePositions.active,
    sortOrder: schema.executivePositions.sortOrder,
    holderId: schema.executiveAssignments.userId,
    holderName: schema.users.name,
    assignmentId: schema.executiveAssignments.id,
  })
    .from(schema.executivePositions)
    .leftJoin(
      schema.executiveAssignments,
      and(
        eq(schema.executiveAssignments.positionId, schema.executivePositions.id),
        isNull(schema.executiveAssignments.endedAt),
      ),
    )
    .leftJoin(schema.users, eq(schema.users.id, schema.executiveAssignments.userId))
    .orderBy(asc(schema.executivePositions.sortOrder))

  return { positions: rows }
})
