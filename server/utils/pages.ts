import type { Page } from '../db/schema/content'
import { hasContent } from './news'

/**
 * Rich pages (issue #16) are a fixed, route-backed set — not user-created — so
 * the allowed slugs are an allow-list here rather than free text. Adding a new
 * standalone page = add its slug here + a route under app/pages/.
 */
export const PAGE_SLUGS = ['about', 'faq', 'privacy'] as const
export type PageSlug = (typeof PAGE_SLUGS)[number]

export function isPageSlug(slug: string | undefined): slug is PageSlug {
  return !!slug && (PAGE_SLUGS as readonly string[]).includes(slug)
}

/**
 * Enforce PRD §12 for a page: it may only be published when BOTH locales carry
 * a title AND non-empty Editor.js content. Mirrors news.assertPublishable but
 * over the page's columns. Throws 422 listing what's missing.
 */
export function assertPagePublishable(
  row: Pick<Page, 'titleEn' | 'titleFr' | 'contentEn' | 'contentFr'>,
) {
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
