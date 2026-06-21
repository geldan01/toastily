import { DeleteObjectCommand } from '@aws-sdk/client-s3'

/**
 * Delete a stored object from the media library (issue #78) — admin only.
 * The object key is passed as `?key=uploads/...` (a query param rather than a
 * path segment so the typed `$fetch` resolves the DELETE method cleanly against
 * the static /api/uploads route).
 *
 * Guards the `uploads/` prefix (can't delete arbitrary keys) and, by default,
 * refuses to delete an object that's still referenced by content — returning
 * 409 with the usage list so the UI can warn. Pass `force=true` to delete an
 * in-use object anyway (the reference becomes a broken image — the admin's
 * call). Returns 503 when storage isn't configured.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')

  const cfg = s3Config()
  if (!isStorageConfigured(cfg)) {
    throw createError({ statusCode: 503, statusMessage: 'Image storage is not configured on this deployment' })
  }

  const query = getQuery(event)
  const key = String(query.key || '').replace(/^\/+/, '')
  if (!key.startsWith('uploads/') || key.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid object key' })
  }

  if (query.force !== 'true') {
    const usage = indexUploadUsage(await gatherUploadRefs()).get(key) ?? []
    if (usage.length) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Image is still in use',
        data: { usage },
      })
    }
  }

  try {
    await useS3Client(cfg).send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }))
  }
  catch (err: unknown) {
    const detail = err as { name?: string, message?: string }
    console.error('[uploads] DeleteObject failed:', detail?.name, detail?.message)
    throw createError({ statusCode: 502, statusMessage: 'Delete from storage failed' })
  }

  return { deleted: true, key }
})
