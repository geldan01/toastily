/**
 * Media library listing (issue #78) — admin only. Returns every object under
 * the bucket's `uploads/` prefix, each annotated with where it's referenced
 * (member avatars, News cover/body, standalone pages, content blocks) so an
 * admin can see what's in use and which objects are orphaned/safe to delete.
 *
 * There's no DB upload-tracking table; usage is recovered by extracting upload
 * keys from content text and matching them against the bucket listing (see
 * server/utils/upload-usage.ts). Returns 503 when storage isn't configured.
 */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'admin')

  // Listing throws 503 when storage is unconfigured — surface that before we
  // bother scanning the DB.
  const { objects, truncated } = await listStoredObjects()

  const usageByKey = indexUploadUsage(await gatherUploadRefs())

  return {
    truncated,
    objects: objects.map(o => ({
      ...o,
      usage: usageByKey.get(o.key) ?? [],
    })),
  }
})
