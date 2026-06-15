import type { News } from '../db/schema/content'

/**
 * Does a stored news body carry real content? Bodies are Editor.js JSON
 * (`{ blocks: [...] }`) for articles authored in-app, or plain text for
 * legacy/seeded rows. Empty means: blank string, or an Editor.js doc whose
 * blocks are all empty (no text / list items / image / embed).
 */
export function hasContent(raw: string | null | undefined): boolean {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return false
  if (!trimmed.startsWith('{')) return true // legacy plain text

  let doc: { blocks?: Array<{ type?: string, data?: Record<string, unknown> }> }
  try {
    doc = JSON.parse(trimmed)
  }
  catch {
    return true // not JSON after all — treat as plain text
  }
  if (!Array.isArray(doc.blocks)) return true
  return doc.blocks.some((b) => {
    const d = b?.data ?? {}
    if (typeof d.text === 'string' && d.text.trim()) return true
    if (Array.isArray(d.items) && d.items.length) return true
    if (d.file && (d.file as { url?: string }).url) return true
    if (typeof d.url === 'string' && d.url) return true
    if (typeof d.embed === 'string' && d.embed) return true
    if (Array.isArray(d.content) && d.content.length) return true // table
    return false
  })
}

/**
 * Enforce PRD §12: a news article may only be published when BOTH locales
 * carry a title AND non-empty content. Throws 422 listing what's missing.
 */
export function assertPublishable(row: Pick<News, 'titleEn' | 'titleFr' | 'contentEn' | 'contentFr'>) {
  const missing: string[] = []
  if (!row.titleEn?.trim()) missing.push('titleEn')
  if (!row.titleFr?.trim()) missing.push('titleFr')
  if (!hasContent(row.contentEn)) missing.push('contentEn')
  if (!hasContent(row.contentFr)) missing.push('contentFr')
  if (missing.length) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Both English and French title and content are required before publishing.',
      data: { missing },
    })
  }
}
