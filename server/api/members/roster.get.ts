import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Club roster (PRD §7.1) — visible to any logged-in member. Lists all
 * members/officers/admins with their current executive position(s), so members
 * can see who's on the team. Email is included for members to reach each other;
 * guests never see this (member-gated).
 */
export default defineEventHandler(async (event) => {
  const viewer = await requireMinRole(event, 'member')
  const db = useDrizzle()

  const people = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      status: schema.users.status,
      since: schema.users.createdAt,
      avatarKey: schema.users.avatarKey,
      bio: schema.users.bio,
      goals: schema.users.goals,
      phone: schema.users.phone,
      showContactInfo: schema.users.showContactInfo,
    })
    .from(schema.users)
    .where(inArray(schema.users.status, ['member', 'officer', 'admin']))
    .orderBy(asc(schema.users.name))

  // Current executive positions (endedAt null) keyed by holder, EN/FR labels.
  const assignments = await db
    .select({
      userId: schema.executiveAssignments.userId,
      nameEn: schema.executivePositions.nameEn,
      nameFr: schema.executivePositions.nameFr,
      sortOrder: schema.executivePositions.sortOrder,
    })
    .from(schema.executiveAssignments)
    .innerJoin(
      schema.executivePositions,
      eq(schema.executivePositions.id, schema.executiveAssignments.positionId),
    )
    .where(and(
      isNull(schema.executiveAssignments.endedAt),
      eq(schema.executivePositions.active, true),
    ))
    .orderBy(asc(schema.executivePositions.sortOrder))

  const positionsByUser = new Map<string, { nameEn: string, nameFr: string }[]>()
  for (const a of assignments) {
    const list = positionsByUser.get(a.userId) ?? []
    list.push({ nameEn: a.nameEn, nameFr: a.nameFr })
    positionsByUser.set(a.userId, list)
  }

  return {
    members: people.map(({ avatarKey, showContactInfo, email, phone, ...p }) => {
      // Contact-visibility preference (issue #61): a member who opted out hides
      // their email/phone from other members; they themselves and admins still
      // see it. The roster is already member-gated regardless.
      const canSeeContact = showContactInfo || viewer.id === p.id || viewer.status === 'admin'
      return {
        ...p,
        email: canSeeContact ? email : null,
        phone: canSeeContact ? (phone ?? null) : null,
        avatarUrl: avatarKey ? publicUrlForKey(avatarKey) : null,
        positions: positionsByUser.get(p.id) ?? [],
      }
    }),
  }
})
