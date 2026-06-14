import { defineConfig } from 'vitest/config'

/**
 * Unit-test runner (PRD §13 — testing). Vitest covers the pure, DB-free logic:
 * the RBAC ladder, agenda speech timing, and award-category constants. Anything
 * that touches Postgres or Nitro auto-imports (capabilities, meeting authority,
 * renumbering, vote derivation) is exercised by the Playwright integration
 * layer instead — see tests/integration and docs/TESTING.md.
 *
 * Kept separate from the Playwright config so `vitest` never tries to run the
 * `.spec.ts` browser/API tests and vice-versa.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    // Playwright owns these — never let Vitest pick them up.
    exclude: ['tests/e2e/**', 'tests/integration/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage/unit',
      // Report the pure-logic modules the unit layer is responsible for. The
      // DB-bound utilities are covered behaviourally by the Playwright
      // integration layer (a separate process), not by line instrumentation —
      // see docs/TESTING.md. `all: false` keeps the table to files actually
      // imported by the unit tests.
      // Only the modules the unit layer is responsible for. (voting.ts is
      // mostly DB-bound — the unit tests pin its award-category constants; the
      // derivation logic is covered by the integration layer.)
      include: [
        'shared/utils/roles.ts',
        'server/utils/speeches.ts',
        'server/utils/voting.ts',
      ],
      all: true,
    },
  },
})
