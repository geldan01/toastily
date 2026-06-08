/** Extract a human-readable message from a $fetch/h3 error, with a fallback. */
export function errorMessage(e: unknown, fallback: string): string {
  const err = e as { data?: { statusMessage?: string, message?: string }, statusMessage?: string }
  return err?.data?.statusMessage || err?.data?.message || err?.statusMessage || fallback
}
