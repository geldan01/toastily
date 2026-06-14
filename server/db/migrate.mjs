// Standalone migration runner for production/CI (no drizzle-kit needed).
// Uses only prod deps (drizzle-orm + postgres). Run: node server/db/migrate.mjs
//
// Why hand-rolled instead of drizzle-orm's `migrate()`? Both drizzle-orm's
// migrator and `drizzle-kit migrate` wrap ALL pending migrations in a SINGLE
// transaction. Migration 0003 adds the enum value `agenda_item_type.evaluations`
// and 0012 uses it — and Postgres forbids using a newly-added enum value in the
// same transaction that added it ("unsafe use of new value"). So a fresh,
// all-at-once apply (a new `docker compose up`, a new contributor, CI) fails,
// even though the dev DB works because it was migrated incrementally over time.
//
// Applying each migration in its OWN committed transaction — exactly how
// incremental `db:migrate` always behaved — fixes it: 0003 commits before 0012
// reads the value. The bookkeeping below is identical in shape and content to
// drizzle's `drizzle.__drizzle_migrations` table (same hash + created_at from
// `readMigrationFiles`), so a database previously migrated by drizzle-kit is
// recognised and never re-applied. See issue #22.
import process from 'node:process'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import postgres from 'postgres'

try {
  process.loadEnvFile?.()
}
catch {
  // no .env in production — vars injected by host
}

const url = process.env.DATABASE_URL ?? process.env.NUXT_DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const MIGRATIONS_FOLDER = './server/db/migrations'

// onnotice: silence "schema/table already exists, skipping" NOTICEs on re-runs.
const sql = postgres(url, { max: 1, onnotice: () => {} })
try {
  const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER })

  // Bookkeeping table — identical shape to drizzle-orm's, so a DB previously
  // migrated by drizzle-kit is recognised and its migrations are not re-run.
  await sql.unsafe('CREATE SCHEMA IF NOT EXISTS "drizzle"')
  await sql.unsafe(
    'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" '
    + '(id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
  )
  const [last] = await sql.unsafe(
    'SELECT created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at DESC LIMIT 1',
  )
  const lastMillis = last ? Number(last.created_at) : -1

  let applied = 0
  for (const migration of migrations) {
    if (migration.folderMillis <= lastMillis) continue
    // One transaction PER migration. Committing between migrations is what makes
    // an enum value added in 0003 usable by the time 0012 runs.
    await sql.begin(async (tx) => {
      for (const statement of migration.sql) {
        await tx.unsafe(statement)
      }
      await tx.unsafe(
        'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
        [migration.hash, migration.folderMillis],
      )
    })
    applied++
  }

  console.log(applied ? `✓ Applied ${applied} migration(s).` : '✓ Database already up to date.')
}
catch (err) {
  console.error('Migration failed:', err)
  process.exitCode = 1
}
finally {
  await sql.end()
}
