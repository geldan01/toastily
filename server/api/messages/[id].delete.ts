import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Remove an internal announcement (PRD §7.1, issue #17). Officer/admin only —
 * any officer may tidy up the announcement board, not just the original author.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'officer')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'A message id is required.' })

  const db = useDrizzle()
  const [deleted] = await db
    .delete(schema.messages)
    .where(eq(schema.messages.id, id))
    .returning({ id: schema.messages.id })

  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Message not found.' })

  return { ok: true }
})
