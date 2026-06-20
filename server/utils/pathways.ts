import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { useDrizzle } from '../db/client'
import { schema } from '../db/client'

/**
 * Pathways progress tracker (issue #58) — read/validation helpers. Personal,
 * self-tracked; NOT a Base Camp replacement (the UI carries that caveat).
 *
 * Each Pathways path has five levels; projects are self-reported (free-text
 * title) and may optionally be tied to a club speech the member delivered.
 */

/** Valid Pathways level numbers (1–5). */
export const PATHWAYS_LEVELS = [1, 2, 3, 4, 5] as const

/** Pure: whether `n` is a valid Pathways level (whole number 1–5). */
export function isValidLevel(n: unknown): boolean {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5
}

export interface TrackerProject {
  id: string
  level: number
  title: string
  completedAt: string | null
  speechId: string | null
  speechDate: string | null
  speechTitle: string | null
}
export interface TrackerEnrollment {
  id: string
  pathId: string
  pathNameEn: string
  pathNameFr: string
  isCurrent: boolean
  startedAt: string | null
  completedAt: string | null
  projects: TrackerProject[]
}
export interface MemberTracker {
  paths: { id: string, nameEn: string, nameFr: string }[]
  enrollments: TrackerEnrollment[]
  speeches: { id: string, date: string, title: string | null, slot: number }[]
}

/**
 * One member's full tracker: the path catalog (for the picker), their
 * enrollments with nested self-reported projects, and the speeches they
 * delivered (for the optional project↔speech link). Read-only aggregation —
 * personal data, the API gates it to the member themselves.
 */
export async function memberTracker(
  db: ReturnType<typeof useDrizzle>,
  userId: string,
): Promise<MemberTracker> {
  const paths = await db.select({
    id: schema.pathwaysPaths.id,
    nameEn: schema.pathwaysPaths.nameEn,
    nameFr: schema.pathwaysPaths.nameFr,
  })
    .from(schema.pathwaysPaths)
    .where(eq(schema.pathwaysPaths.active, true))
    .orderBy(asc(schema.pathwaysPaths.sortOrder), asc(schema.pathwaysPaths.nameEn))

  const enrollmentRows = await db.select({
    id: schema.memberPathways.id,
    pathId: schema.memberPathways.pathId,
    pathNameEn: schema.pathwaysPaths.nameEn,
    pathNameFr: schema.pathwaysPaths.nameFr,
    isCurrent: schema.memberPathways.isCurrent,
    startedAt: schema.memberPathways.startedAt,
    completedAt: schema.memberPathways.completedAt,
    createdAt: schema.memberPathways.createdAt,
  })
    .from(schema.memberPathways)
    .innerJoin(schema.pathwaysPaths, eq(schema.pathwaysPaths.id, schema.memberPathways.pathId))
    .where(eq(schema.memberPathways.userId, userId))
    .orderBy(desc(schema.memberPathways.isCurrent), desc(schema.memberPathways.createdAt))

  const enrollmentIds = enrollmentRows.map(e => e.id)
  const projectRows = enrollmentIds.length
    ? await db.select({
        id: schema.memberPathwayProjects.id,
        enrollmentId: schema.memberPathwayProjects.enrollmentId,
        level: schema.memberPathwayProjects.level,
        title: schema.memberPathwayProjects.title,
        completedAt: schema.memberPathwayProjects.completedAt,
        speechId: schema.memberPathwayProjects.speechId,
        speechDate: schema.meetings.date,
        speechTitle: schema.speeches.title,
      })
        .from(schema.memberPathwayProjects)
        .leftJoin(schema.speeches, eq(schema.speeches.id, schema.memberPathwayProjects.speechId))
        .leftJoin(schema.meetings, eq(schema.meetings.id, schema.speeches.meetingId))
        .where(inArray(schema.memberPathwayProjects.enrollmentId, enrollmentIds))
        .orderBy(asc(schema.memberPathwayProjects.level), desc(schema.memberPathwayProjects.completedAt))
    : []

  const projectsByEnrollment = new Map<string, TrackerProject[]>()
  for (const p of projectRows) {
    const list = projectsByEnrollment.get(p.enrollmentId) ?? []
    list.push({
      id: p.id,
      level: p.level,
      title: p.title,
      completedAt: p.completedAt,
      speechId: p.speechId,
      speechDate: p.speechDate,
      speechTitle: p.speechTitle,
    })
    projectsByEnrollment.set(p.enrollmentId, list)
  }

  // The member's delivered speeches, for the optional project↔speech link.
  const speeches = await db.select({
    id: schema.speeches.id,
    date: schema.meetings.date,
    title: schema.speeches.title,
    slot: schema.speeches.slot,
  })
    .from(schema.speeches)
    .innerJoin(schema.meetings, eq(schema.meetings.id, schema.speeches.meetingId))
    .where(eq(schema.speeches.presenterUserId, userId))
    .orderBy(desc(schema.meetings.date))

  return {
    paths,
    enrollments: enrollmentRows.map(e => ({
      id: e.id,
      pathId: e.pathId,
      pathNameEn: e.pathNameEn,
      pathNameFr: e.pathNameFr,
      isCurrent: e.isCurrent,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      projects: projectsByEnrollment.get(e.id) ?? [],
    })),
    speeches,
  }
}

/**
 * Load an enrollment owned by `userId`, or throw 404. Centralizes the ownership
 * check so every mutation endpoint stays scoped to the member's own data.
 */
export async function requireOwnEnrollment(
  db: ReturnType<typeof useDrizzle>,
  enrollmentId: string,
  userId: string,
) {
  const [row] = await db.select()
    .from(schema.memberPathways)
    .where(and(eq(schema.memberPathways.id, enrollmentId), eq(schema.memberPathways.userId, userId)))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Enrollment not found.' })
  return row
}

/**
 * Resolve a `speechId` to mirror its label, ensuring the member is that speech's
 * speaker. Returns the speech id when valid, or null when no link was requested.
 * Throws 403 if the member tries to link a speech they didn't deliver.
 */
export async function resolveLinkedSpeech(
  db: ReturnType<typeof useDrizzle>,
  speechId: string | null | undefined,
  userId: string,
): Promise<string | null> {
  if (!speechId) return null
  const [speech] = await db.select({ id: schema.speeches.id, presenterUserId: schema.speeches.presenterUserId })
    .from(schema.speeches).where(eq(schema.speeches.id, speechId)).limit(1)
  if (!speech) throw createError({ statusCode: 404, statusMessage: 'Speech not found.' })
  if (speech.presenterUserId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'You can only link your own speeches.' })
  }
  return speech.id
}

/**
 * Mirror a project's title into the linked speech's `pathways_project`
 * placeholder (issue #58 ties a speech to a project via the existing field), and
 * clear a previously-linked speech when the link moves or is removed. Only ever
 * touches speeches the member delivered (enforced by resolveLinkedSpeech).
 */
export async function syncSpeechPathwaysLabel(
  db: ReturnType<typeof useDrizzle>,
  opts: { previousSpeechId?: string | null, newSpeechId: string | null, title: string | null },
) {
  const { previousSpeechId, newSpeechId, title } = opts
  if (previousSpeechId && previousSpeechId !== newSpeechId) {
    await db.update(schema.speeches)
      .set({ pathwaysProject: null })
      .where(eq(schema.speeches.id, previousSpeechId))
  }
  if (newSpeechId) {
    await db.update(schema.speeches)
      .set({ pathwaysProject: title })
      .where(eq(schema.speeches.id, newSpeechId))
  }
}
