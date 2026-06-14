import { PutObjectCommand } from '@aws-sdk/client-s3'

/**
 * Upload an image to S3-compatible object storage (issue #10, PRD §2/§15).
 *
 * Restricted to users with the content-edit capability. Accepts a single
 * multipart file field (`file`), validates its type/size, stores it under a
 * random, year/month-partitioned key, and returns the persistent public URL —
 * either the bucket's direct URL (when `S3_PUBLIC_BASE_URL` is set) or the
 * Nitro proxy at /api/uploads/<key>. Reusable by News and content-block image
 * fields.
 */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)

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
})
