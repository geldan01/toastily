import { schema, useDrizzle } from '../../db/client'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_BODY = 5000

/**
 * Post an internal announcement (PRD §7.1, issue #17). Authoring is gated to
 * officers/admins — plain members only read. `pinned` floats it to the top;
 * `expiresAt` (optional `YYYY-MM-DD`) hides it after the end of that day.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'officer')
  const body = await readBody(event)

  const text = String(body?.body ?? '').trim()
  if (!text) throw createError({ statusCode: 400, statusMessage: 'A message body is required.' })
  if (text.length > MAX_BODY) throw createError({ statusCode: 400, statusMessage: `Message is too long (max ${MAX_BODY} characters).` })

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
    .values({ body: text, pinned, expiresAt, authorId: user.id })
    .returning()

  return { message: row }
})
