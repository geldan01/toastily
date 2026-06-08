import { asc, inArray } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Member roster for signup-assignment pickers on the meeting page. Available to
 * any logged-in member, since meeting managers who assign others may be the
 * meeting's Toastmaster (a plain member), not only officers. Returns id + name
 * only — no emails. PRD §6.2.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'member')
  const rows = await useDrizzle()
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(inArray(schema.users.status, ['member', 'officer', 'admin']))
    .orderBy(asc(schema.users.name))
  return { members: rows }
})
