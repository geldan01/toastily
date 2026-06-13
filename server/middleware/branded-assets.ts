import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

// Serve per-deployment branded assets (favicon, logo, etc.) from /branded-public,
// which is bind-mounted by the host. These files are gitignored (trademarked
// Toastmasters branding) so they aren't baked into the Nitro static manifest.
export default defineEventHandler((event) => {
  const path = event.path
  const ext = path.match(/\.[a-z]+$/i)?.[0]?.toLowerCase()
  if (!ext || !MIME[ext]) return

  const file = join('/branded-public', path)
  if (!existsSync(file)) return

  setResponseHeader(event, 'Content-Type', MIME[ext])
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  return readFileSync(file)
})
