import { asc, inArray } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/** Members/officers/admins, for assignment pickers (admin). PRD §3.2. */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'officer')
  const rows = await useDrizzle()
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, status: schema.users.status })
    .from(schema.users)
    .where(inArray(schema.users.status, ['member', 'officer', 'admin']))
    .orderBy(asc(schema.users.name))
  return { members: rows }
})
