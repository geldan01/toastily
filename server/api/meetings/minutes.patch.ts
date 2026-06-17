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

/**
 * Approve a prior meeting's minutes as read/amended (PRD §6, issue #14). Done at
 * the start of the next meeting when the body accepts the previous minutes — the
 * minutes must already be submitted (you can't approve what doesn't exist).
 * Amendment corrections are kept in `amendmentNotes` (cleared when read clean).
 * Authority is over the meeting being approved.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const meetingId = String(body?.meetingId ?? '')
  const status = body?.status
  if (!meetingId) throw createError({ statusCode: 400, statusMessage: 'meetingId is required.' })
  if (status !== 'read' && status !== 'amended') {
    throw createError({ statusCode: 400, statusMessage: 'status must be \'read\' or \'amended\'.' })
  }

  const user = await requireMinutesManager(event, meetingId)

  const db = useDrizzle()
  const [existing] = await db.select({ id: schema.meetingMinutes.id })
    .from(schema.meetingMinutes)
    .where(eq(schema.meetingMinutes.meetingId, meetingId))
    .limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Minutes not found' })

  const now = new Date()
  const amendmentNotes = status === 'amended'
    ? (String(body?.amendmentNotes ?? '').trim() || null)
    : null

  await db.update(schema.meetingMinutes)
    .set({
      approvalStatus: status,
      approvedBy: user.id,
      approvedAt: now,
      updatedAt: now,
      amendmentNotes,
    })
    .where(eq(schema.meetingMinutes.meetingId, meetingId))

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
