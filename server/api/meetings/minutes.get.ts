import { desc, eq, isNotNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { schema, useDrizzle } from '../../db/client'

interface MinutesRow {
  id: string
  meetingId: string
  date: string
  meetingNumber: number | null
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

/**
 * List all submitted meeting minutes (PRD §6, issue #14). Member-gated, for the
 * members area: every minutes row that has been submitted, newest meeting first,
 * with the meeting date/number and resolved submitter/approver names.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'member')

  const db = useDrizzle()
  const submitter = alias(schema.users, 'submitter')
  const approver = alias(schema.users, 'approver')

  const rows = await db.select({
    id: schema.meetingMinutes.id,
    meetingId: schema.meetingMinutes.meetingId,
    date: schema.meetings.date,
    meetingNumber: schema.meetings.meetingNumber,
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
    .innerJoin(schema.meetings, eq(schema.meetings.id, schema.meetingMinutes.meetingId))
    .leftJoin(submitter, eq(submitter.id, schema.meetingMinutes.submittedBy))
    .leftJoin(approver, eq(approver.id, schema.meetingMinutes.approvedBy))
    .where(isNotNull(schema.meetingMinutes.submittedAt))
    .orderBy(desc(schema.meetings.date))

  const minutes = rows.map((row: MinutesRow) => ({
    meetingId: row.meetingId,
    date: row.date,
    meetingNumber: row.meetingNumber,
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
  }))

  return { minutes }
})
