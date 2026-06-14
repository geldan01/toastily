/**
 * Prepare a fresh, dedicated TEST database before a Playwright run:
 *   1. DROP + CREATE <name>_test (a clean slate every run — deterministic).
 *   2. apply migrations with the real production runner (server/db/migrate.mjs).
 *   3. run the generic, club-agnostic seed (roles, agenda template, exec
 *      positions, settings) so meetings/voting tests have something to build on.
 *
 * Because it uses the SAME runner the Docker image runs at boot, every test run
 * is also a regression check that a fresh, all-at-once migration apply works
 * (the bug from #22 — drizzle's batched single-transaction apply tripped over an
 * enum value added in 0003 and used in 0012).
 *
 * Test ACCOUNTS are NOT created here — global-setup does that against the
 * running server so passwords are hashed by the real register endpoint.
 *
 * Run via: tsx tests/setup/prepare-test-db.ts
 */
import { execSync } from 'node:child_process'
import postgres from 'postgres'
import { TEST_DATABASE_URL } from './config'

async function recreateDatabase() {
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, '')
  const adminUrl = new URL(TEST_DATABASE_URL)
  adminUrl.pathname = '/postgres'

  const sql = postgres(adminUrl.toString(), { max: 1 })
  try {
    // WITH (FORCE) drops even if a stray dev server still holds a connection.
    console.log(`Recreating test database "${dbName}"…`)
    await sql.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
    await sql.unsafe(`CREATE DATABASE "${dbName}"`)
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}

function run(cmd: string) {
  console.log(`$ ${cmd}`)
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  })
}

async function main() {
  await recreateDatabase()
  run('node server/db/migrate.mjs') // the real production runner (#22)
  run('pnpm tsx server/db/seed.ts')
  console.log('✓ Test database ready.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('prepare-test-db failed:', err)
    process.exit(1)
  })
