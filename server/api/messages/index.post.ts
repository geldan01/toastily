import { schema, useDrizzle } from '../../db/client'
import { notifyAnnouncement } from '../../utils/notifications'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_TITLE = 200
const MAX_BODY = 5000

/**
 * Post an internal announcement (PRD §7.1, issues #17/#63). Authoring is gated
 * to communication managers (`canManageCommunication`) — never a hard-coded
 * role; plain members only read. As user-generated content the title + body are
 * **bilingual**: all four EN/FR fields are required before publishing. `pinned`
 * floats it to the top; `expiresAt` (optional `YYYY-MM-DD`) hides it after the
 * end of that day. When `sendEmail` is set, the announcement is also fanned out
 * to all members via the notifications pipeline (PRD §10).
 */
export default defineEventHandler(async (event) => {
  const user = await requireCommunicationManager(event)
  const body = await readBody(event)

  const requireField = (value: unknown, label: string, max: number) => {
    const text = String(value ?? '').trim()
    if (!text) throw createError({ statusCode: 400, statusMessage: `${label} is required.` })
    if (text.length > max) throw createError({ statusCode: 400, statusMessage: `${label} is too long (max ${max} characters).` })
    return text
  }

  const titleEn = requireField(body?.titleEn, 'An English title', MAX_TITLE)
  const titleFr = requireField(body?.titleFr, 'A French title', MAX_TITLE)
  const bodyEn = requireField(body?.bodyEn, 'An English message', MAX_BODY)
  const bodyFr = requireField(body?.bodyFr, 'A French message', MAX_BODY)

  const pinned = body?.pinned === true

  let expiresAt: Date | null = null
  if (body?.expiresAt) {
    const raw = String(body.expiresAt).trim()
    if (!DATE_RE.test(raw)) throw createError({ statusCode: 400, statusMessage: 'Expiry must be a valid date (YYYY-MM-DD).' })
    // Keep the announcement visible through the whole chosen day.
    expiresAt = new Date(`${raw}T23:59:59.999`)
    if (Number.isNaN(expiresAt.getTime())) throw createError({ statusCode: 400, statusMessage: 'Expiry must be a valid date (YYYY-MM-DD).' })
  }

  const db = useDrizzle()
  const [row] = await db
    .insert(schema.messages)
    .values({ titleEn, titleFr, bodyEn, bodyFr, pinned, expiresAt, authorId: user.id })
    .returning()

  // Optional fan-out to members' inboxes via the notifications pipeline. Never
  // throws — a delivery problem must not fail the post; the outcome is logged.
  const email = body?.sendEmail === true
    ? await notifyAnnouncement({ titleEn, titleFr, bodyEn, bodyFr, triggeredBy: user.id })
    : null

  return { message: row, email }
})
