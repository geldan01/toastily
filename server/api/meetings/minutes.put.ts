import { eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { schema, useDrizzle } from '../../db/client'

interface MinutesRow {
  id: string
  unfinishedBusiness: string | null
  newBusiness: string | null
  upcomingEvents: string | null
  specialReminders: string | null
  generalEvaluatorMention: string | null
  submittedBy: string | null
  submitterName: string | null
  submittedAt: Date | null
  approvalStatus: 'pending' | 'read' | 'amended'
  approvedBy: string | null
  approverName: string | null
  approvedAt: Date | null
  amendmentNotes: string | null
}

/** Shape a joined minutes row into the shared MinutesRecord (ISO timestamps). */
function toMinutesRecord(row: MinutesRow | undefined) {
  if (!row) return null
  return {
    id: row.id,
    unfinishedBusiness: row.unfinishedBusiness,
    newBusiness: row.newBusiness,
    upcomingEvents: row.upcomingEvents,
    specialReminders: row.specialReminders,
    generalEvaluatorMention: row.generalEvaluatorMention,
    submittedBy: row.submittedBy,
    submitterName: row.submitterName,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    approvalStatus: row.approvalStatus,
    approvedBy: row.approvedBy,
    approverName: row.approverName,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    amendmentNotes: row.amendmentNotes,
  }
}

/** Normalize a section field: trim, empty string → null, absent → null. */
function normalizeSection(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Submit/update this meeting's minutes (PRD §6, issue #14). The secretary (or an
 * admin / minutes-capable officer) writes the five narrative sections; an upsert
 * keyed on `meetingId` lets them revise before approval. Approval columns are
 * never touched here — they're set separately via PATCH when a prior meeting's
 * minutes are accepted as read/amended.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const meetingId = String(body?.meetingId ?? '')
  if (!meetingId) throw createError({ statusCode: 400, statusMessage: 'meetingId is required.' })

  const db = useDrizzle()
  const [meeting] = await db.select({ id: schema.meetings.id })
    .from(schema.meetings).where(eq(schema.meetings.id, meetingId)).limit(1)
  if (!meeting) throw createError({ statusCode: 404, statusMessage: 'Meeting not found.' })

  const user = await requireMinutesManager(event, meetingId)

  const sections = {
    unfinishedBusiness: normalizeSection(body?.unfinishedBusiness),
    newBusiness: normalizeSection(body?.newBusiness),
    upcomingEvents: normalizeSection(body?.upcomingEvents),
    specialReminders: normalizeSection(body?.specialReminders),
    generalEvaluatorMention: normalizeSection(body?.generalEvaluatorMention),
  }
  const now = new Date()

  await db.insert(schema.meetingMinutes)
    .values({
      meetingId,
      ...sections,
      submittedBy: user.id,
      submittedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.meetingMinutes.meetingId,
      set: {
        ...sections,
        submittedBy: user.id,
        submittedAt: now,
        updatedAt: now,
      },
    })

  // Re-query with name joins for the response projection.
  const submitter = alias(schema.users, 'submitter')
  const approver = alias(schema.users, 'approver')
  const [row] = await db.select({
    id: schema.meetingMinutes.id,
    unfinishedBusiness: schema.meetingMinutes.unfinishedBusiness,
    newBusiness: schema.meetingMinutes.newBusiness,
    upcomingEvents: schema.meetingMinutes.upcomingEvents,
    specialReminders: schema.meetingMinutes.specialReminders,
    generalEvaluatorMention: schema.meetingMinutes.generalEvaluatorMention,
    submittedBy: schema.meetingMinutes.submittedBy,
    submitterName: submitter.name,
    submittedAt: schema.meetingMinutes.submittedAt,
    approvalStatus: schema.meetingMinutes.approvalStatus,
    approvedBy: schema.meetingMinutes.approvedBy,
    approverName: approver.name,
    approvedAt: schema.meetingMinutes.approvedAt,
    amendmentNotes: schema.meetingMinutes.amendmentNotes,
  })
    .from(schema.meetingMinutes)
    .leftJoin(submitter, eq(submitter.id, schema.meetingMinutes.submittedBy))
    .leftJoin(approver, eq(approver.id, schema.meetingMinutes.approvedBy))
    .where(eq(schema.meetingMinutes.meetingId, meetingId))
    .limit(1)

  return { minutes: toMinutesRecord(row) }
})
