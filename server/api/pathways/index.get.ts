import { useDrizzle } from '../../db/client'

/**
 * The current member's Pathways tracker (issue #58): the path catalog, their own
 * enrollments with nested self-reported projects, and their delivered speeches
 * (for the optional project↔speech link). PRIVATE — personal, self-tracked data,
 * scoped to the requester. Members only.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const db = useDrizzle()
  return await memberTracker(db, user.id)
})
