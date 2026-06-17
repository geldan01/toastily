interface Capabilities {
  canManageCalendar: boolean
  canManageContent: boolean
  canAssignOfficers: boolean
  canManageMinutes: boolean
}

/**
 * The current user's effective capabilities (executive positions + grants +
 * admin), shared across components by key. Drives management-UI visibility;
 * the server enforces each capability independently.
 */
export function useCapabilities() {
  return useFetch<Capabilities>('/api/me/capabilities', {
    key: 'me-capabilities',
    default: () => ({ canManageCalendar: false, canManageContent: false, canAssignOfficers: false, canManageMinutes: false }),
  })
}
