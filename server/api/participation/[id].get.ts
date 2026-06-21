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
  // Written peer evaluations a member received are private to that speaker, and
  // contact info follows the member's visibility preference (issue #61) — both
  // are included only for the member themselves or an admin.
  const viewer = await getCurrentUser(event)
  const isSelfOrAdmin = viewer?.id === id || viewer?.status === 'admin'
  const db = useDrizzle()
  const participation = await memberParticipation(db, id, {
    includeReceivedEvaluations: isSelfOrAdmin,
    includeContact: isSelfOrAdmin,
  })
  if (!participation) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found.' })
  }
  return participation
})
