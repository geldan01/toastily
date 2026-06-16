import { asc, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../../db/client'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Member attendance for a meeting (issue #35). Member-gated, mirroring the guest
 * check-in list. Returns the members marked present (with name + how it was
 * recorded), the present count (members + guests) used as a quorum aid, whether
 * the viewer is present (drives the self check-in toggle), and whether the viewer
 * may manage attendance (assign/clear others). The roster for the manager's
 * pre-filled editor comes from GET /api/meetings/members.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'member')
  const viewer = await getCurrentUser(event)
  const date = getRouterParam(event, 'date')!
  if (!DATE_RE.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Date must be YYYY-MM-DD.' })
  }

  const db = useDrizzle()
  const [meeting] = await db.select({ id: schema.meetings.id })
    .from(schema.meetings).where(eq(schema.meetings.date, date)).limit(1)
  if (!meeting) {
    return { meetingId: null, present: [], count: { members: 0, guests: 0, total: 0 }, selfPresent: false, canManage: false }
  }

  const present = await db.select({
    id: schema.meetingAttendance.id,
    userId: schema.meetingAttendance.userId,
    name: schema.users.name,
    source: schema.meetingAttendance.source,
  })
    .from(schema.meetingAttendance)
    .innerJoin(schema.users, eq(schema.users.id, schema.meetingAttendance.userId))
    .where(eq(schema.meetingAttendance.meetingId, meeting.id))
    .orderBy(asc(schema.users.name))

  const count = await meetingPresentCount(db, meeting.id)
  const canManage = await isMeetingManager(viewer, meeting.id)
  const selfPresent = present.some(p => p.userId === viewer?.id)

  return { meetingId: meeting.id, present, count, selfPresent, canManage }
})
