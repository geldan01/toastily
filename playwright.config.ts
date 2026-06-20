import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, TEST_DATABASE_URL, TEST_PORT, TEST_SESSION_PASSWORD } from './tests/setup/config'

/**
 * Playwright drives BOTH test layers (see docs/TESTING.md):
 *  - tests/integration/*.spec.ts — API/contract tests via the `request` context
 *    (auth flow, membership, signup authority, voting, capabilities);
 *  - tests/e2e/*.spec.ts — full browser journeys per RBAC role.
 *
 * Pure-logic unit tests live in tests/unit and run under Vitest, never here
 * (this config only matches *.spec.ts).
 *
 * The webServer boots the app against the DEDICATED test database. Run
 * `pnpm test:db:prepare` first (the `test:e2e` script chains it) so migrations
 * and the generic seed are in place before the server starts; global-setup then
 * seeds the per-role accounts against the live server.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/setup/global-setup.ts',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'integration',
      testDir: './tests/integration',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // The DB must already be migrated+seeded (pnpm test:db:prepare, chained by
    // the test:e2e script). `pnpm dev` needs no build step; Playwright's spawn
    // env overrides DATABASE_URL to the test DB (dotenv won't clobber an
    // already-set var), so dev data is never touched.
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NUXT_SESSION_PASSWORD: TEST_SESSION_PASSWORD,
      SITE_URL: BASE_URL,
      PORT: TEST_PORT,
      NUXT_PORT: TEST_PORT,
      // Keep object storage unconfigured in tests (dotenv won't clobber an
      // already-set var) so the upload route's gating is deterministic
      // regardless of a developer's local .env — see uploads-api.spec.ts.
      S3_ENDPOINT: '',
      // Likewise keep CAPTCHA unconfigured so register/reset flows (and the
      // account-seeding global-setup) run without a Turnstile token, matching
      // CI — see server/utils/turnstile.ts.
      TURNSTILE_SECRET_KEY: '',
      NUXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    },
  },
})
