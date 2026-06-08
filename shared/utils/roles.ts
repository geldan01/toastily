// Account-level access ladder (PRD §3.1). Shared by client UI gating and
// server middleware. Auto-imported in both app and server (Nuxt `shared/`).
export const ROLE_ORDER = { guest: 0, member: 1, officer: 2, admin: 3 } as const

export type AccountStatus = keyof typeof ROLE_ORDER

/** True if `status` is at least `min` on the ladder. */
export function hasMinRole(status: string | null | undefined, min: AccountStatus): boolean {
  if (!status || !(status in ROLE_ORDER)) return false
  return ROLE_ORDER[status as AccountStatus] >= ROLE_ORDER[min]
}
