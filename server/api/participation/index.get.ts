import { useDrizzle } from '../../db/client'

/**
 * Club-wide participation summary (PRD §11) — one row per member with their
 * roles / speeches / evaluations / award counts. Visible to any logged-in
 * member; drives the aggregate /participation table.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'member')
  const db = useDrizzle()
  return { members: await participationSummary(db) }
})
