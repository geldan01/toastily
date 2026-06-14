// Load .env so DATABASE_URL (and friends) are available when this config is
// imported by the prepare-db script or the Playwright config — neither tsx nor
// Playwright auto-loads it. The app server loads its own env separately.
try {
  process.loadEnvFile?.()
}
catch {
  // .env is optional (CI injects env directly).
}

/**
 * Shared configuration for the Playwright (integration + e2e) layers.
 *
 * Tests run against a DEDICATED Postgres database so they never touch dev data.
 * The URL is resolved, in order of precedence:
 *   1. TEST_DATABASE_URL (explicit override — what CI sets)
 *   2. derived from DATABASE_URL by swapping the db name for `<name>_test`
 *      (so a local dev DB on a non-standard port/host is reused automatically)
 *   3. the docker-compose default, db name `toastily_test`
 */
function deriveTestDbUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL
  if (explicit) return explicit

  const dev = process.env.DATABASE_URL
  if (dev) {
    try {
      const u = new URL(dev)
      const name = u.pathname.replace(/^\//, '') || 'toastily'
      u.pathname = `/${name}_test`
      return u.toString()
    }
    catch {
      // fall through to the compose default
    }
  }
  return 'postgres://toastily:toastily@localhost:5432/toastily_test'
}

export const TEST_DATABASE_URL = deriveTestDbUrl()

// A DEDICATED port so the test server never collides with (or reuses) a dev
// server already running on 3000 — which would point at the dev database.
export const TEST_PORT = process.env.TEST_PORT || '3100'
export const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${TEST_PORT}`

/**
 * A deterministic 32+ char session secret for the test server. Not a real
 * secret — only used to seal cookies for the throwaway test database.
 */
export const TEST_SESSION_PASSWORD
  = process.env.TEST_SESSION_PASSWORD || 'test-only-session-password-change-me-0001'

/** Where per-role authenticated storage states are written by global-setup. */
export const STORAGE_STATE_DIR = 'tests/.auth'
