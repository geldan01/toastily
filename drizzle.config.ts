import { defineConfig } from 'drizzle-kit'

// Load .env for CLI usage (Node 22+). Nuxt loads its own env at runtime.
try {
  process.loadEnvFile?.()
}
catch {
  // .env is optional (e.g. CI provides env directly)
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema',
  out: './server/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
})
