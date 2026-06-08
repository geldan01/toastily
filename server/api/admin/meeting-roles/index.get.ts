import { asc } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/** List every meeting role (admin), ordered for the editor. PRD §3.3. */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')
  const rows = await useDrizzle()
    .select()
    .from(schema.meetingRoles)
    .orderBy(asc(schema.meetingRoles.sortOrder), asc(schema.meetingRoles.createdAt))
  return { roles: rows }
})
