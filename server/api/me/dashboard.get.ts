import { useDrizzle } from '../../db/client'

/** How many recent items of each kind the dashboard shows. */
const RECENT_LIMIT = 5

/**
 * Personal member dashboard (issue #57) — the logged-in member's own upcoming
 * commitments (roles, speeches, evaluations across the next scheduled meetings)
 * plus a trimmed slice of recent activity. Read-side only; reuses
 * `myCommitments` and the `memberParticipation` history aggregation. Member-gated.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'member')
  const db = useDrizzle()

  const today = new Date().toISOString().slice(0, 10)
  const commitments = await myCommitments(db, user.id, today)

  // Recent activity reuses the history aggregation, trimmed to the last few of
  // each kind (already newest-first from memberParticipation).
  const history = await memberParticipation(db, user.id)
  const recent = {
    attended: (history?.attendance ?? []).slice(0, RECENT_LIMIT),
    roles: (history?.roles ?? []).slice(0, RECENT_LIMIT),
    speeches: (history?.speeches ?? []).slice(0, RECENT_LIMIT),
  }

  return {
    memberId: user.id,
    nextMeeting: commitments.nextMeeting,
    upcoming: commitments.meetings,
    recent,
  }
})
