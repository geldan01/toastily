import { useDrizzle } from '../../db/client'
import { MILESTONE_CATALOG } from '../../utils/milestones'

/**
 * Achievement badge catalog with the *current* members who hold each (issue
 * #64). The whole catalog is returned in order (badges with no holders included)
 * so the page can show every milestone; holders come from `membersWithMilestones`,
 * which is roster-filtered — revoked members never appear. Member-gated.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'member')
  const db = useDrizzle()
  const members = await membersWithMilestones(db)

  const holdersByKey = new Map<string, { id: string, name: string }[]>()
  for (const m of members) {
    for (const badge of m.milestones) {
      const list = holdersByKey.get(badge.key) ?? []
      list.push({ id: m.id, name: m.name })
      holdersByKey.set(badge.key, list)
    }
  }

  return {
    badges: MILESTONE_CATALOG.map(def => ({
      key: def.key,
      category: def.category,
      threshold: def.threshold,
      holders: holdersByKey.get(def.key) ?? [],
    })),
  }
})
