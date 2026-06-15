import { describe, expect, it } from 'vitest'
import { isEditorJsDoc, renderEditorJs } from '../../app/utils/editorjs'

/**
 * Editor.js JSON → HTML renderer behind the public News page (issue #12). The
 * renderer is pure and SSR-safe; here we pin block coverage, the plain-text
 * fallback detection, and that synthesised attributes are escaped.
 */
describe('isEditorJsDoc', () => {
  it('recognises an Editor.js doc object and JSON string', () => {
    expect(isEditorJsDoc({ blocks: [] })).toBe(true)
    expect(isEditorJsDoc('{"blocks":[{"type":"paragraph","data":{"text":"hi"}}]}')).toBe(true)
  })

  it('rejects plain text and malformed JSON', () => {
    expect(isEditorJsDoc('Just a sentence.')).toBe(false)
    expect(isEditorJsDoc('{not json}')).toBe(false)
    expect(isEditorJsDoc('')).toBe(false)
    expect(isEditorJsDoc(null)).toBe(false)
  })
})

describe('renderEditorJs', () => {
  it('renders headers, paragraphs and a delimiter', () => {
    const html = renderEditorJs({
      blocks: [
        { type: 'header', data: { text: 'Title', level: 3 } },
        { type: 'paragraph', data: { text: 'Hello <b>world</b>' } },
        { type: 'delimiter', data: {} },
      ],
    })
    expect(html).toContain('<h3>Title</h3>')
    // Inline HTML from Editor.js inline tools is preserved verbatim.
    expect(html).toContain('<p>Hello <b>world</b></p>')
    expect(html).toContain('<hr>')
  })

  it('clamps header levels into 1..6 and defaults invalid levels to 2', () => {
    expect(renderEditorJs({ blocks: [{ type: 'header', data: { text: 'X', level: 9 } }] })).toContain('<h6>')
    expect(renderEditorJs({ blocks: [{ type: 'header', data: { text: 'X', level: 1 } }] })).toContain('<h1>')
    expect(renderEditorJs({ blocks: [{ type: 'header', data: { text: 'X' } }] })).toContain('<h2>')
  })

  it('renders ordered and nested lists', () => {
    const ordered = renderEditorJs({ blocks: [{ type: 'list', data: { style: 'ordered', items: ['a', 'b'] } }] })
    expect(ordered).toBe('<ol><li>a</li><li>b</li></ol>')

    const nested = renderEditorJs({
      blocks: [{
        type: 'list',
        data: { style: 'unordered', items: [{ content: 'parent', items: [{ content: 'child', items: [] }] }] },
      }],
    })
    expect(nested).toBe('<ul><li>parent<ul><li>child</li></ul></li></ul>')
  })

  it('renders an image figure and escapes the src', () => {
    const html = renderEditorJs({
      blocks: [{ type: 'image', data: { file: { url: 'https://x/y.png?a=1&b=2' }, caption: 'Cap' } }],
    })
    expect(html).toContain('src="https://x/y.png?a=1&amp;b=2"')
    expect(html).toContain('<figcaption>Cap</figcaption>')
  })

  it('renders a table with headings', () => {
    const html = renderEditorJs({
      blocks: [{ type: 'table', data: { withHeadings: true, content: [['H1', 'H2'], ['a', 'b']] } }],
    })
    expect(html).toContain('<th>H1</th><th>H2</th>')
    expect(html).toContain('<td>a</td><td>b</td>')
  })

  it('skips empty image blocks and unknown block types gracefully', () => {
    expect(renderEditorJs({ blocks: [{ type: 'image', data: {} }] })).toBe('')
    expect(renderEditorJs({ blocks: [{ type: 'mystery', data: {} }] })).toBe('')
    expect(renderEditorJs({ blocks: [{ type: 'mystery', data: { text: 'fallback' } }] })).toBe('<p>fallback</p>')
  })

  it('returns empty string for invalid input', () => {
    expect(renderEditorJs('not json')).toBe('')
    expect(renderEditorJs(null)).toBe('')
    expect(renderEditorJs({})).toBe('')
  })
})
