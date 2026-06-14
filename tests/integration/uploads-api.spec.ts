import { expect, test } from '../fixtures/roles'

/**
 * Image-upload backend contract (issue #10, PRD §2/§15). Uploads are gated on
 * the content-edit capability (`effectiveCapabilities`), so only admins (and,
 * later, content-managing officers / delegated grant holders) get past the
 * gate. The S3 wiring itself isn't configured in the test env — the route is
 * forced unconfigured via playwright.config (S3_ENDPOINT='') — so an authorised
 * caller deterministically hits the 503 "not configured" branch rather than a
 * real bucket. That's enough to pin the auth boundary and the
 * graceful-degradation behaviour without standing up MinIO in CI.
 */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

function filePayload() {
  return { file: { name: 'pic.png', mimeType: 'image/png', buffer: PNG_1PX } }
}

test.describe('uploads API', () => {
  test('rejects anonymous callers with 401', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).post('/api/uploads', { multipart: filePayload() })
    expect(res.status()).toBe(401)
  })

  test('rejects a plain member (no content capability) with 403', async ({ apiAs }) => {
    const res = await (await apiAs('member')).post('/api/uploads', { multipart: filePayload() })
    expect(res.status()).toBe(403)
  })

  test('rejects a plain officer (no exec position) with 403', async ({ apiAs }) => {
    const res = await (await apiAs('officer')).post('/api/uploads', { multipart: filePayload() })
    expect(res.status()).toBe(403)
  })

  test('lets an admin past the gate (503 when storage is unconfigured)', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).post('/api/uploads', { multipart: filePayload() })
    expect(res.status()).toBe(503)
  })

  test('the proxy route is unconfigured-safe too', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).get('/api/uploads/uploads/2026/03/abc.png')
    expect(res.status()).toBe(503)
  })
})
