import { S3Client } from '@aws-sdk/client-s3'
import { createError } from 'h3'

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
