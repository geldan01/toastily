// Standalone migration runner for production/CI (no drizzle-kit needed).
// Uses only prod deps (drizzle-orm + postgres). Run: node server/db/migrate.mjs
import process from 'node:process'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

try { process.loadEnvFile?.() } catch { /* no .env in production — vars injected by host */ }

const url = process.env.DATABASE_URL ?? process.env.NUXT_DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const sql = postgres(url, { max: 1 })
try {
  await migrate(drizzle(sql), { migrationsFolder: './server/db/migrations' })
  console.log('✓ Migrations applied.')
}
catch (err) {
  console.error('Migration failed:', err)
  process.exitCode = 1
}
finally {
  await sql.end()
}
