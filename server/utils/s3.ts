import type { H3Event } from 'h3'
import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createError, readMultipartFormData } from 'h3'

/**
 * S3-compatible object storage for uploaded images (issue #10, PRD §2/§15).
 *
 * Backend-agnostic: the same code drives MinIO (self-hosted on Coolify),
 * Cloudflare R2, Backblaze B2 or AWS S3 — only the `s3.*` runtime config
 * (endpoint/bucket/keys) differs. All values come from env (Coolify), never
 * from code, per the project's no-secrets-in-repo rule.
 */

export interface S3Config {
  endpoint: string
  region: string
  bucket: string
  accessKey: string
  secretKey: string
  forcePathStyle: boolean
  publicBaseUrl: string
  maxBytes: number
}

/** The S3 runtime config block (see nuxt.config.ts `runtimeConfig.s3`). */
export function s3Config(): S3Config {
  return useRuntimeConfig().s3 as S3Config
}

/**
 * Whether object storage is configured. When false, the upload route returns
 * 503 instead of failing obscurely — uploads are an optional, per-deployment
 * capability.
 */
export function isStorageConfigured(cfg: S3Config = s3Config()): boolean {
  return Boolean(cfg.endpoint && cfg.bucket && cfg.accessKey && cfg.secretKey)
}

/**
 * Allowed image content-types → canonical file extension. Used both to reject
 * non-images and to give uploaded objects a sensible key/extension.
 */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

/**
 * Validate an upload's declared content-type and byte size, throwing a readable
 * 4xx on failure. Returns the canonical extension for the type.
 */
export function validateImageUpload(contentType: string | undefined, size: number, cfg: S3Config = s3Config()): string {
  const type = (contentType || '').split(';')[0]!.trim().toLowerCase()
  const ext = ALLOWED_IMAGE_TYPES[type]
  if (!ext) {
    throw createError({
      statusCode: 415,
      statusMessage: `Unsupported image type. Allowed: ${Object.keys(ALLOWED_IMAGE_TYPES).join(', ')}`,
    })
  }
  if (!size || size <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Empty file' })
  }
  if (size > cfg.maxBytes) {
    const mb = (cfg.maxBytes / (1024 * 1024)).toFixed(1)
    throw createError({ statusCode: 413, statusMessage: `File too large (max ${mb} MB)` })
  }
  return ext
}

/**
 * A stable, collision-resistant object key. Partitioned by year/month so the
 * bucket stays browsable, with a random UUID base so keys never clash and can't
 * be guessed/enumerated.
 */
export function generateImageKey(ext: string, now = new Date()): string {
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `uploads/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`
}

/**
 * Public URL for a stored object. If the bucket is served directly (a
 * `publicBaseUrl` is configured) we return that; otherwise callers fetch
 * through the Nitro proxy at /api/uploads/<key>.
 */
export function publicUrlForKey(key: string, cfg: S3Config = s3Config()): string {
  if (cfg.publicBaseUrl) {
    return `${cfg.publicBaseUrl.replace(/\/$/, '')}/${key}`
  }
  return `/api/uploads/${key}`
}

/**
 * Read a single multipart `file` field from the request, validate its type/size
 * and store it under a random, year/month-partitioned key. Returns the object
 * key and its persistent public URL. Throws 503 when storage is unconfigured,
 * 400 when no file is present, 4xx on validation failure, and 502 on a storage
 * error. Shared by the content-manager upload route and self-service avatars —
 * the caller is responsible for authorization before calling this.
 */
export async function storeImageUpload(event: H3Event): Promise<{ key: string, url: string }> {
  const cfg = s3Config()
  if (!isStorageConfigured(cfg)) {
    throw createError({ statusCode: 503, statusMessage: 'Image storage is not configured on this deployment' })
  }

  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.filename)
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'Expected a multipart "file" field' })
  }

  const ext = validateImageUpload(file.type, file.data.length, cfg)
  const key = generateImageKey(ext)

  try {
    await useS3Client(cfg).send(new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: file.data,
      ContentType: file.type,
      // Hashed/random keys are immutable, so allow aggressive caching.
      CacheControl: 'public, max-age=31536000, immutable',
    }))
  }
  catch (err: unknown) {
    // Surface storage failures as a 502 (not an opaque 500) and log the real
    // cause server-side — credentials/endpoint/checksum problems are otherwise
    // invisible. Never echo the raw error to the client.
    const detail = err as { name?: string, message?: string }
    console.error('[uploads] PutObject failed:', detail?.name, detail?.message)
    throw createError({ statusCode: 502, statusMessage: 'Upload to storage failed' })
  }

  return { key, url: publicUrlForKey(key, cfg) }
}

/** A stored object as surfaced to the admin media library (issue #78). */
export interface StoredObject {
  key: string
  size: number
  lastModified: string | null
  url: string
}

/**
 * List every object under the `uploads/` prefix (issue #78). Pages through
 * ListObjectsV2 (1000 keys/page) up to `max` keys so the bucket can't blow up
 * the response; sets `truncated` when more objects exist than were returned.
 * Newest-first by last-modified. Caller is responsible for authorization.
 */
export async function listStoredObjects(
  max = 2000,
  cfg: S3Config = s3Config(),
): Promise<{ objects: StoredObject[], truncated: boolean }> {
  if (!isStorageConfigured(cfg)) {
    throw createError({ statusCode: 503, statusMessage: 'Image storage is not configured on this deployment' })
  }

  const objects: StoredObject[] = []
  let token: string | undefined
  let truncated = false

  do {
    const page = await useS3Client(cfg).send(new ListObjectsV2Command({
      Bucket: cfg.bucket,
      Prefix: 'uploads/',
      ContinuationToken: token,
    }))
    for (const o of page.Contents ?? []) {
      if (!o.Key) continue
      objects.push({
        key: o.Key,
        size: o.Size ?? 0,
        lastModified: o.LastModified ? o.LastModified.toISOString() : null,
        url: publicUrlForKey(o.Key, cfg),
      })
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
    if (objects.length >= max && token) {
      truncated = true
      break
    }
  } while (token)

  objects.sort((a, b) => (b.lastModified ?? '').localeCompare(a.lastModified ?? ''))
  return { objects: objects.slice(0, max), truncated }
}

/**
 * Best-effort delete of a stored object (e.g. a replaced/removed avatar). Never
 * throws: a failed cleanup must not fail the user's request — the orphaned
 * object is harmless. No-op when storage is unconfigured.
 */
export async function deleteStoredObject(key: string, cfg: S3Config = s3Config()): Promise<void> {
  if (!isStorageConfigured(cfg) || !key) return
  try {
    await useS3Client(cfg).send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }))
  }
  catch (err: unknown) {
    const detail = err as { name?: string, message?: string }
    console.error('[uploads] DeleteObject failed:', detail?.name, detail?.message)
  }
}

let client: S3Client | null = null

/** Lazily-built, memoised S3 client for the configured backend. */
export function useS3Client(cfg: S3Config = s3Config()): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: cfg.forcePathStyle,
      credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
      // @aws-sdk/client-s3 ≥ 3.729 sends request checksums (CRC32) by default,
      // which Cloudflare R2 — and other S3-compatible backends like MinIO/B2 —
      // reject, failing every PutObject. Only compute checksums when the API
      // actually requires them (Cloudflare's recommended JS-SDK config). Safe
      // for AWS S3 too, so it keeps the client backend-agnostic.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }
  return client
}
