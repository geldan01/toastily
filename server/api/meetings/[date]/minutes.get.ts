import { and, desc, eq, lt } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { schema, useDrizzle } from '../../../db/client'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

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
function toMinutesRecord(row: MinutesRow | undefined | null) {
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

/**
 * Meeting-minutes detail by date (PRD §6, issue #14). Member-gated, mirroring
 * the attendance detail endpoint. Returns this meeting's minutes record (null
 * until a secretary submits), a present count (quorum aid), whether the viewer
 * may manage minutes, and the previous 5 scheduled meetings (each with their
 * minutes, if any) so the meeting can be opened by reading/approving the prior
 * minutes. `meetingId: null` when no meeting exists for the date.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'member')
  const viewer = await getCurrentUser(event)
  const date = getRouterParam(event, 'date')!
  if (!DATE_RE.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Date must be YYYY-MM-DD.' })
  }

  const db = useDrizzle()
  const [meeting] = await db.select({
    id: schema.meetings.id,
    date: schema.meetings.date,
    meetingNumber: schema.meetings.meetingNumber,
  })
    .from(schema.meetings).where(eq(schema.meetings.date, date)).limit(1)

  if (!meeting) {
    return {
      meetingId: null,
      date,
      meetingNumber: null,
      canManage: false,
      quorum: { members: 0, guests: 0, total: 0, threshold: null, history: [], met: false },
      minutes: null,
      previous: [],
    }
  }

  const canManage = await canManageMeetingMinutes(viewer, meeting.id)
  const quorum = await meetingQuorum(db, meeting.id, meeting.date)

  // This meeting's minutes (null when no row).
  const submitter = alias(schema.users, 'submitter')
  const approver = alias(schema.users, 'approver')
  const minutesSelect = {
    id: schema.meetingMinutes.id,
    meetingId: schema.meetingMinutes.meetingId,
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
  }

  const [thisRow] = await db.select(minutesSelect)
    .from(schema.meetingMinutes)
    .leftJoin(submitter, eq(submitter.id, schema.meetingMinutes.submittedBy))
    .leftJoin(approver, eq(approver.id, schema.meetingMinutes.approvedBy))
    .where(eq(schema.meetingMinutes.meetingId, meeting.id))
    .limit(1)

  // The previous 3 scheduled meetings (most recent first), each with its minutes
  // (null when none submitted yet) so the secretary can read them and see each
  // one's approval status — and approve/amend any that are still pending.
  const prevMeetings = await db.select({
    id: schema.meetings.id,
    date: schema.meetings.date,
    meetingNumber: schema.meetings.meetingNumber,
  })
    .from(schema.meetings)
    .where(and(
      eq(schema.meetings.status, 'scheduled'),
      lt(schema.meetings.date, meeting.date),
    ))
    .orderBy(desc(schema.meetings.date))
    .limit(3)

  const previous = await Promise.all(prevMeetings.map(async (m) => {
    const [row] = await db.select(minutesSelect)
      .from(schema.meetingMinutes)
      .leftJoin(submitter, eq(submitter.id, schema.meetingMinutes.submittedBy))
      .leftJoin(approver, eq(approver.id, schema.meetingMinutes.approvedBy))
      .where(eq(schema.meetingMinutes.meetingId, m.id))
      .limit(1)
    return {
      meetingId: m.id,
      date: m.date,
      meetingNumber: m.meetingNumber,
      minutes: toMinutesRecord(row),
    }
  }))

  return {
    meetingId: meeting.id,
    date: meeting.date,
    meetingNumber: meeting.meetingNumber,
    canManage,
    quorum,
    minutes: toMinutesRecord(thisRow),
    previous,
  }
})
