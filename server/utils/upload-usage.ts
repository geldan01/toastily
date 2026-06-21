/**
 * Provenance / usage scanning for the admin media library (issue #78).
 *
 * Uploaded images have no DB tracking table — objects land in S3 under the
 * `uploads/<yyyy>/<mm>/<uuid>.<ext>` prefix and are referenced from content by
 * their public URL (`/api/uploads/<key>` or the bucket's direct URL) or, for
 * member avatars, by the raw key (`users.avatar_key`). Both forms embed the
 * full object key verbatim, so we can recover "where is this image used?" by
 * extracting upload keys from each piece of content and matching them against
 * the bucket listing — purely string-based, backend-agnostic, no schema change.
 *
 * Everything here is pure (no DB / no S3) so it can be unit-tested directly; the
 * GET /api/uploads endpoint feeds it rows and the bucket key set.
 */

/** Where a referenced image lives, for display in the media library. */
export type UploadUsageKind = 'avatar' | 'news' | 'page' | 'contentBlock'

export interface UploadUsage {
  kind: UploadUsageKind
  /** Human label for the referencing record (member name, article title, …). */
  label: string
  /** Optional id/slug of the referencing record, for linking. */
  ref?: string
}

/** A piece of content to scan: its free-text payload + how to describe it. */
export interface UploadRef extends UploadUsage {
  /** Concatenated text that may embed one or more upload keys/URLs. */
  text: string | null | undefined
}

/**
 * Matches a full object key (`uploads/2026/05/<uuid>.<ext>`) wherever it
 * appears — as a raw key, inside the proxy path, or inside a bucket URL. The
 * uuid segment is intentionally permissive (`generateImageKey` uses
 * crypto.randomUUID, but legacy/avatar keys may differ), the extension is any
 * alphanumeric run.
 */
export const UPLOAD_KEY_RE = /uploads\/\d{4}\/\d{2}\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+/g

/** Distinct upload keys embedded anywhere in `text`. */
export function extractUploadKeys(text: string | null | undefined): string[] {
  if (!text) return []
  const matches = text.match(UPLOAD_KEY_RE)
  return matches ? [...new Set(matches)] : []
}

/**
 * Build a key → usages map from content refs. A ref's text may embed several
 * keys (e.g. multiple images in an article body); each contributes the same
 * usage descriptor. Keys never referenced simply don't appear in the map —
 * the caller treats those bucket objects as orphans.
 */
export function indexUploadUsage(refs: UploadRef[]): Map<string, UploadUsage[]> {
  const map = new Map<string, UploadUsage[]>()
  for (const ref of refs) {
    const usage: UploadUsage = { kind: ref.kind, label: ref.label, ref: ref.ref }
    for (const key of extractUploadKeys(ref.text)) {
      const list = map.get(key)
      if (list) list.push(usage)
      else map.set(key, [usage])
    }
  }
  return map
}
