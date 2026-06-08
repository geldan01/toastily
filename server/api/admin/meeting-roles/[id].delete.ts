import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

/**
 * Delete a meeting role (admin). Blocked when the role is referenced by an
 * agenda item or a past signup — history is first-class (PRD §11), so callers
 * are told to deactivate instead. Returns 409 in that case.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')
  const id = getRouterParam(event, 'id')!
  const db = useDrizzle()

  const [signup] = await db.select({ id: schema.meetingRoleSignups.id })
    .from(schema.meetingRoleSignups)
    .where(eq(schema.meetingRoleSignups.roleId, id))
    .limit(1)
  const [item] = await db.select({ id: schema.agendaTemplateItems.id })
    .from(schema.agendaTemplateItems)
    .where(eq(schema.agendaTemplateItems.meetingRoleId, id))
    .limit(1)
  if (signup || item) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This role is in use. Deactivate it instead of deleting.',
    })
  }

  const [row] = await db.delete(schema.meetingRoles)
    .where(eq(schema.meetingRoles.id, id))
    .returning({ id: schema.meetingRoles.id })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Role not found.' })
  return { ok: true }
})
