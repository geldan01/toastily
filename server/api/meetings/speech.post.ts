import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Claim or assign a speech speaker/evaluator (PRD §6.3). Mirrors role signup:
 *  - a member claims an OPEN speaker/evaluator slot for themselves;
 *  - a meeting manager (officer/admin OR the meeting's authority-role holder,
 *    e.g. the Toastmaster) assigns a member (`userId`) or guest (`guestName`),
 *    and may reassign a filled slot.
 * Creates the speech row for the slot on first claim. `field` is 'speaker' or
 * 'evaluator'. One speech per meeting+slot (unique).
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  if (!hasMinRole(user.status, 'member')) throw createError({ statusCode: 403, statusMessage: 'Members only' })

  const body = await readBody(event)
  const meetingId = String(body?.meetingId ?? '')
  const slot = Number(body?.slot)
  const field = body?.field === 'evaluator' ? 'evaluator' : 'speaker'
  if (!meetingId || !Number.isInteger(slot) || slot < 1) {
    throw createError({ statusCode: 400, statusMessage: 'meetingId and a valid slot are required.' })
  }

  const db = useDrizzle()
  const [meeting] = await db.select({ id: schema.meetings.id }).from(schema.meetings).where(eq(schema.meetings.id, meetingId)).limit(1)
  if (!meeting) throw createError({ statusCode: 404, statusMessage: 'Meeting not found.' })

  const canManage = await isMeetingManager(user, meetingId)
  let targetUserId: string | null = user.id
  let guestName: string | null = null
  if (canManage && (body?.guestName || body?.userId)) {
    if (body.guestName) {
      const g = String(body.guestName).trim()
      if (!g) throw createError({ statusCode: 400, statusMessage: 'Guest name cannot be empty.' })
      targetUserId = null
      guestName = g
    }
    else { targetUserId = String(body.userId) }
  }

  const userCol = field === 'speaker' ? 'presenterUserId' : 'evaluatorUserId'
  const guestCol = field === 'speaker' ? 'presenterGuestName' : 'evaluatorGuestName'

  const [existing] = await db.select().from(schema.speeches)
    .where(and(eq(schema.speeches.meetingId, meetingId), eq(schema.speeches.slot, slot)))
    .limit(1)

  if (existing) {
    const filled = field === 'speaker' ? (existing.presenterUserId || existing.presenterGuestName) : (existing.evaluatorUserId || existing.evaluatorGuestName)
    if (filled && !canManage) throw createError({ statusCode: 409, statusMessage: 'This slot is already taken.' })
    const [row] = await db.update(schema.speeches)
      .set({ [userCol]: targetUserId, [guestCol]: guestName })
      .where(eq(schema.speeches.id, existing.id))
      .returning()
    return { speech: row }
  }

  const timing = await speechTiming()
  const [row] = await db.insert(schema.speeches)
    .values({ meetingId, slot, [userCol]: targetUserId, [guestCol]: guestName, minMinutes: timing.defaultMin, maxMinutes: timing.defaultMax })
    .returning()
  return { speech: row }
})
