/**
 * Upload an image to S3-compatible object storage (issue #10, PRD §2/§15).
 *
 * Restricted to users with the content-edit capability. Accepts a single
 * multipart file field (`file`), validates its type/size, stores it under a
 * random, year/month-partitioned key, and returns the persistent public URL —
 * either the bucket's direct URL (when `S3_PUBLIC_BASE_URL` is set) or the
 * Nitro proxy at /api/uploads/<key>. Reusable by News and content-block image
 * fields. Self-service avatars share the same storage via /api/me/avatar.
 */
export default defineEventHandler(async (event) => {
  await requireContentManager(event)
  return storeImageUpload(event)
})
