import { and, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/**
 * Update a speech slot's title and/or timing window (PRD §6.3). Editable by a
 * meeting manager (officer/admin OR the meeting's authority-role holder, e.g.
 * the Toastmaster), or by the member who holds that slot's speaker role. Creates
 * the row if missing (managers only, since otherwise the editor must be the
 * speaker — which requires a row). `minMinutes`/`maxMinutes` are the speech's
 * timing window (min ≤ max); the agenda allots max + buffer per speech.
 */
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  if (!hasMinRole(user.status, 'member')) throw createError({ statusCode: 403, statusMessage: 'Members only' })

  const body = await readBody(event)
  const meetingId = String(body?.meetingId ?? '')
  const slot = Number(body?.slot)
  if (!meetingId || !Number.isInteger(slot) || slot < 1) {
    throw createError({ statusCode: 400, statusMessage: 'meetingId and a valid slot are required.' })
  }

  const hasTitle = body?.title !== undefined
  const hasMin = body?.minMinutes !== undefined
  const hasMax = body?.maxMinutes !== undefined
  if (!hasTitle && !hasMin && !hasMax) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update.' })
  }

  const title = hasTitle ? (body.title == null ? null : String(body.title).trim() || null) : undefined

  // Parse the supplied timing fields (positive integers).
  function parseMinutes(v: unknown, label: string): number {
    const n = Number(v)
    if (!Number.isInteger(n) || n < 1) {
      throw createError({ statusCode: 400, statusMessage: `${label} must be a positive whole number of minutes.` })
    }
    return n
  }
  const newMin = hasMin ? parseMinutes(body.minMinutes, 'Minimum') : undefined
  const newMax = hasMax ? parseMinutes(body.maxMinutes, 'Maximum') : undefined

  const db = useDrizzle()
  const canManage = await isMeetingManager(user, meetingId)
  const timing = await speechTiming()

  const [existing] = await db.select().from(schema.speeches)
    .where(and(eq(schema.speeches.meetingId, meetingId), eq(schema.speeches.slot, slot)))
    .limit(1)

  // Validate the resulting window (min ≤ max), filling gaps from the existing
  // row or the club defaults.
  const effMin = newMin ?? existing?.minMinutes ?? timing.defaultMin
  const effMax = newMax ?? existing?.maxMinutes ?? timing.defaultMax
  if ((hasMin || hasMax) && effMin > effMax) {
    throw createError({ statusCode: 400, statusMessage: 'Minimum time cannot exceed maximum time.' })
  }

  const updates: Record<string, unknown> = {}
  if (hasTitle) updates.title = title
  if (hasMin) updates.minMinutes = newMin
  if (hasMax) updates.maxMinutes = newMax

  if (!existing) {
    if (!canManage) throw createError({ statusCode: 403, statusMessage: 'Claim the speaker slot before editing the speech.' })
    const [meeting] = await db.select({ id: schema.meetings.id }).from(schema.meetings).where(eq(schema.meetings.id, meetingId)).limit(1)
    if (!meeting) throw createError({ statusCode: 404, statusMessage: 'Meeting not found.' })
    const [row] = await db.insert(schema.speeches)
      .values({ meetingId, slot, minMinutes: effMin, maxMinutes: effMax, ...updates })
      .returning()
    return { speech: row }
  }

  if (!canManage && existing.presenterUserId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Only the speaker or a meeting manager can edit the speech.' })
  }
  const [row] = await db.update(schema.speeches).set(updates).where(eq(schema.speeches.id, existing.id)).returning()
  return { speech: row }
})
