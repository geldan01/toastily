/**
 * Minimal typings for the Cloudflare Turnstile browser API (issue #26).
 * The script is loaded on demand from challenges.cloudflare.com and attaches a
 * `turnstile` global; we only use the small render/reset/remove surface.
 */
export {}

interface TurnstileRenderOptions {
  'sitekey': string
  'callback'?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
  'language'?: string
  'theme'?: 'auto' | 'light' | 'dark'
  'action'?: string
}

interface TurnstileApi {
  render: (el: HTMLElement, options: TurnstileRenderOptions) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}
