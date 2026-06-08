type SettingsMap = Record<string, string>

/**
 * Reactive access to public club settings (club name, schedule, contact,
 * branding…). Fetched once and shared via a stable key. Use `setting(key)` to
 * read a value with an optional fallback — never hard-code club values.
 */
export function useSettings() {
  const { data } = useFetch<SettingsMap>('/api/settings/public', {
    key: 'public-settings',
    default: () => ({}),
  })

  function setting(key: string, fallback = ''): string {
    return data.value?.[key] || fallback
  }

  return { settings: data, setting }
}
