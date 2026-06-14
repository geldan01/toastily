/**
 * Prepare a fresh, dedicated TEST database before a Playwright run:
 *   1. DROP + CREATE <name>_test (a clean slate every run — deterministic).
 *   2. apply every migration, each statement auto-committed in order.
 *   3. run the generic, club-agnostic seed (roles, agenda template, exec
 *      positions, settings) so meetings/voting tests have something to build on.
 *
 * Why a hand-rolled migrator instead of `drizzle-kit migrate`? Both drizzle-kit
 * and drizzle-orm's migrator wrap all pending migrations in a SINGLE
 * transaction. Migration 0003 adds the enum value `agenda_item_type.evaluations`
 * and 0012 uses it — Postgres forbids using a new enum value in the same
 * transaction that added it ("unsafe use of new value"), so a fresh all-at-once
 * apply fails. (The dev DB only works because it was migrated incrementally over
 * time.) Applying each statement with autocommit, in journal order, reproduces
 * the incremental behaviour and is the contract every test relies on. The same
 * latent bug affects a fresh production deploy and is tracked separately.
 *
 * Test ACCOUNTS are NOT created here — global-setup does that against the
 * running server so passwords are hashed by the real register endpoint.
 *
 * Run via: tsx tests/setup/prepare-test-db.ts
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { TEST_DATABASE_URL } from './config'

const MIGRATIONS_DIR = join(process.cwd(), 'server/db/migrations')

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

interface JournalEntry { idx: number, tag: string }

async function applyMigrations() {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8')) as {
    entries: JournalEntry[]
  }
  const ordered = [...journal.entries].sort((a, b) => a.idx - b.idx)

  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} })
  try {
    for (const entry of ordered) {
      const file = readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`), 'utf8')
      const statements = file
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(Boolean)
      // Autocommit each statement so enum values (0003) commit before later
      // migrations (0012) reference them.
      for (const statement of statements) {
        await sql.unsafe(statement)
      }
    }
    console.log(`Applied ${ordered.length} migrations.`)
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}

function seed() {
  console.log('Seeding generic data…')
  execSync('pnpm tsx server/db/seed.ts', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  })
}

async function main() {
  await recreateDatabase()
  await applyMigrations()
  seed()
  console.log('✓ Test database ready.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('prepare-test-db failed:', err)
    process.exit(1)
  })
