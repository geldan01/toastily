import { isNotNull } from 'drizzle-orm'
import { schema, useDrizzle } from '../db/client'

/**
 * Gather every piece of content that may reference an uploaded image, as
 * UploadRefs for the media library's usage scan (issue #78): member avatars,
 * News (cover + bilingual body), standalone pages (bilingual body) and content
 * blocks. DB-backed counterpart to the pure key-matching in upload-usage.ts;
 * shared by the GET listing and the DELETE in-use guard so both see the same
 * provenance. Keys are matched out of these texts, never tracked in a table.
 */
export async function gatherUploadRefs(): Promise<UploadRef[]> {
  const db = useDrizzle()
  const [members, articles, pages, blocks] = await Promise.all([
    db
      .select({ id: schema.users.id, name: schema.users.name, avatarKey: schema.users.avatarKey })
      .from(schema.users)
      .where(isNotNull(schema.users.avatarKey)),
    db
      .select({
        id: schema.news.id,
        title: schema.news.titleEn,
        image: schema.news.image,
        contentEn: schema.news.contentEn,
        contentFr: schema.news.contentFr,
      })
      .from(schema.news),
    db
      .select({
        slug: schema.pages.slug,
        title: schema.pages.titleEn,
        contentEn: schema.pages.contentEn,
        contentFr: schema.pages.contentFr,
      })
      .from(schema.pages),
    db
      .select({
        id: schema.contentBlocks.id,
        page: schema.contentBlocks.page,
        section: schema.contentBlocks.section,
        image: schema.contentBlocks.image,
      })
      .from(schema.contentBlocks),
  ])

  return [
    ...members.map(m => ({
      kind: 'avatar' as const,
      label: m.name,
      ref: m.id,
      text: m.avatarKey,
    })),
    ...articles.map(n => ({
      kind: 'news' as const,
      label: n.title,
      ref: n.id,
      text: [n.image, n.contentEn, n.contentFr].filter(Boolean).join('\n'),
    })),
    ...pages.map(p => ({
      kind: 'page' as const,
      label: p.title || p.slug,
      ref: p.slug,
      text: [p.contentEn, p.contentFr].filter(Boolean).join('\n'),
    })),
    ...blocks.map(b => ({
      kind: 'contentBlock' as const,
      label: `${b.page} / ${b.section}`,
      ref: b.id,
      text: b.image,
    })),
  ]
}
