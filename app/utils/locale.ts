/**
 * Pick the locale-appropriate value from a DB row that carries paired
 * `<base>En` / `<base>Fr` fields (PRD §12). Falls back to the other language
 * so a half-translated row still renders something rather than blank.
 *
 * Example: localized(article, 'title', 'fr') → article.titleFr ?? article.titleEn
 */
export function localized(
  row: Record<string, unknown> | null | undefined,
  base: string,
  locale: string,
): string {
  if (!row) return ''
  const primary = `${base}${locale === 'fr' ? 'Fr' : 'En'}`
  const fallback = `${base}${locale === 'fr' ? 'En' : 'Fr'}`
  return (row[primary] as string) || (row[fallback] as string) || ''
}
