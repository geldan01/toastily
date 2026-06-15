/**
 * Render Editor.js document JSON to an HTML string for the public site
 * (issue #12, PRD §5.3). Pure & SSR-safe — no DOM access — so it runs during
 * Nitro server render as well as on the client.
 *
 * News bodies are stored as Editor.js JSON in `content_en` / `content_fr`.
 * Legacy / seeded articles hold plain text; `isEditorJsDoc` detects the format
 * so the public page can fall back to a `whitespace-pre-line` render for those.
 *
 * Inline text (paragraph/header/quote/list/cell) is Editor.js-produced HTML
 * (bold, italic, links, inline code) and is emitted verbatim — authoring is
 * restricted to content managers (trusted), the same trust model as any CMS.
 * Values we synthesise (URLs, attributes) are escaped.
 */

export interface EditorJsBlock {
  type: string
  data: Record<string, unknown>
}

export interface EditorJsDoc {
  blocks: EditorJsBlock[]
  time?: number
  version?: string
}

/** True when `raw` parses as an Editor.js document (`{ blocks: [...] }`). */
export function isEditorJsDoc(raw: unknown): raw is EditorJsDoc {
  if (typeof raw === 'object' && raw !== null) {
    return Array.isArray((raw as EditorJsDoc).blocks)
  }
  if (typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{')) return false
  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed?.blocks)
  }
  catch {
    return false
  }
}

/** Escape a value destined for an HTML attribute or text node. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderList(data: Record<string, unknown>): string {
  const ordered = data.style === 'ordered'
  const tag = ordered ? 'ol' : 'ul'
  const items = Array.isArray(data.items) ? data.items : []
  const lis = items.map((item) => {
    // @editorjs/list v2 items can be a string or { content, items: [...] }.
    if (typeof item === 'string') return `<li>${item}</li>`
    const obj = item as { content?: string, items?: unknown[] }
    const nested = Array.isArray(obj.items) && obj.items.length
      ? renderList({ style: data.style, items: obj.items })
      : ''
    return `<li>${obj.content ?? ''}${nested}</li>`
  }).join('')
  return `<${tag}>${lis}</${tag}>`
}

function renderTable(data: Record<string, unknown>): string {
  const rows = Array.isArray(data.content) ? (data.content as string[][]) : []
  const withHeadings = data.withHeadings === true
  const body = rows.map((row, i) => {
    const cellTag = withHeadings && i === 0 ? 'th' : 'td'
    const cells = (Array.isArray(row) ? row : []).map(c => `<${cellTag}>${c ?? ''}</${cellTag}>`).join('')
    return `<tr>${cells}</tr>`
  }).join('')
  return `<table><tbody>${body}</tbody></table>`
}

function renderBlock(block: EditorJsBlock): string {
  const data = block.data ?? {}
  switch (block.type) {
    case 'header': {
      const level = Math.min(Math.max(Number(data.level) || 2, 1), 6)
      return `<h${level}>${data.text ?? ''}</h${level}>`
    }
    case 'paragraph':
      return `<p>${data.text ?? ''}</p>`
    case 'list':
    case 'nestedlist':
      return renderList(data)
    case 'quote': {
      const caption = data.caption ? `<cite>${data.caption}</cite>` : ''
      return `<blockquote>${data.text ?? ''}${caption}</blockquote>`
    }
    case 'image': {
      const file = (data.file as { url?: string }) ?? {}
      const url = (data.url as string) ?? file.url
      if (!url) return ''
      const caption = data.caption ? `<figcaption>${data.caption}</figcaption>` : ''
      const alt = esc(typeof data.caption === 'string' ? data.caption : '')
      return `<figure><img src="${esc(url)}" alt="${alt}" loading="lazy">${caption}</figure>`
    }
    case 'embed': {
      const url = data.embed as string
      if (!url) return ''
      const caption = data.caption ? `<figcaption>${data.caption}</figcaption>` : ''
      return `<figure class="embed"><iframe src="${esc(url)}" frameborder="0" allowfullscreen loading="lazy"></iframe>${caption}</figure>`
    }
    case 'delimiter':
      return '<hr>'
    case 'table':
      return renderTable(data)
    default:
      // Unknown block — render any plain `text` field defensively, else skip.
      return typeof data.text === 'string' ? `<p>${data.text}</p>` : ''
  }
}

/**
 * Render an Editor.js document (object or JSON string) to an HTML string.
 * Returns '' for empty/invalid input.
 */
export function renderEditorJs(raw: unknown): string {
  let doc: EditorJsDoc | null = null
  if (typeof raw === 'string') {
    try {
      doc = JSON.parse(raw)
    }
    catch {
      return ''
    }
  }
  else if (typeof raw === 'object' && raw !== null) {
    doc = raw as EditorJsDoc
  }
  if (!doc || !Array.isArray(doc.blocks)) return ''
  return doc.blocks.map(renderBlock).join('\n')
}
