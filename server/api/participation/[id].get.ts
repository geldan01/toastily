import { useDrizzle } from '../../db/client'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * One member's participation timeline (PRD §11): roles taken, speeches given,
 * evaluations done, awards won, executive positions and account-status history.
 * Visible to any logged-in member. 404 when the id is not a member.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'member')
  const id = getRouterParam(event, 'id')!
  if (!UUID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid member id.' })
  }
  const db = useDrizzle()
  const participation = await memberParticipation(db, id)
  if (!participation) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found.' })
  }
  return participation
})
