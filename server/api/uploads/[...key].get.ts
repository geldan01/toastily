import { GetObjectCommand } from '@aws-sdk/client-s3'

/**
 * Public proxy for stored images (issue #10) — used when the bucket isn't
 * served directly (no `S3_PUBLIC_BASE_URL`). Streams the object from S3 through
 * Nitro so images render on the public site without exposing bucket
 * credentials. Unauthenticated by design (images are public content); the
 * `uploads/` prefix guard prevents fetching arbitrary keys.
 */
export default defineEventHandler(async (event) => {
  const cfg = s3Config()
  if (!isStorageConfigured(cfg)) {
    throw createError({ statusCode: 503, statusMessage: 'Image storage is not configured on this deployment' })
  }

  const key = (getRouterParam(event, 'key') || '').replace(/^\/+/, '')
  if (!key.startsWith('uploads/') || key.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid object key' })
  }

  let res
  try {
    res = await useS3Client(cfg).send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }))
  }
  catch (err: unknown) {
    const name = (err as { name?: string })?.name
    if (name === 'NoSuchKey' || name === 'NotFound') {
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
    throw err
  }

  if (res.ContentType) setHeader(event, 'content-type', res.ContentType)
  setHeader(event, 'cache-control', res.CacheControl || 'public, max-age=31536000, immutable')

  // AWS SDK v3 Body is a web ReadableStream in Nitro's runtime; hand it to h3.
  return res.Body!.transformToWebStream()
})
