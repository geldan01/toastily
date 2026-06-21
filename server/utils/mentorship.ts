import { and, eq, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { useDrizzle } from '../db/client'
import { schema } from '../db/client'

/**
 * Mentorship pairings (PRD §11, issue #62). Read-side helpers that resolve the
 * CURRENT pairing (rows with `endedAt` null) for a member — the active mentor
 * they're mentored by, and the active mentees they mentor. The pairing is meant
 * to be visible on both members' pages, so these carry no privacy gate; the
 * pairing's `id` is included so people-managers can end it.
 */

export interface MentorshipLink {
  /** The mentorship row id — used by people-managers to end the pairing. */
  mentorshipId: string
  /** The other member in the pairing. */
  userId: string
  name: string
}

export interface MentorshipFor {
  mentor: MentorshipLink | null
  mentees: MentorshipLink[]
}

/** The current mentor (if any) and current mentees of a member. */
export async function mentorshipFor(
  db: ReturnType<typeof useDrizzle>,
  userId: string,
): Promise<MentorshipFor> {
  const mentorUser = alias(schema.users, 'mentor_user')
  const menteeUser = alias(schema.users, 'mentee_user')

  const [mentorRow] = await db.select({
    mentorshipId: schema.mentorships.id,
    userId: mentorUser.id,
    name: mentorUser.name,
  })
    .from(schema.mentorships)
    .innerJoin(mentorUser, eq(mentorUser.id, schema.mentorships.mentorUserId))
    .where(and(
      eq(schema.mentorships.menteeUserId, userId),
      isNull(schema.mentorships.endedAt),
    ))
    .limit(1)

  const menteeRows = await db.select({
    mentorshipId: schema.mentorships.id,
    userId: menteeUser.id,
    name: menteeUser.name,
  })
    .from(schema.mentorships)
    .innerJoin(menteeUser, eq(menteeUser.id, schema.mentorships.menteeUserId))
    .where(and(
      eq(schema.mentorships.mentorUserId, userId),
      isNull(schema.mentorships.endedAt),
    ))
    .orderBy(menteeUser.name)

  return { mentor: mentorRow ?? null, mentees: menteeRows }
}
