import { expect, test } from '../fixtures/roles'

/**
 * Self-service profile-picture contract (issue #43). Unlike /api/uploads (gated
 * on the content-edit capability), avatars are self-service: any member+ may set
 * their *own* picture. The handler only ever writes the caller's row, so a
 * member can't change another member's avatar by construction.
 *
 * As with the uploads test, S3 isn't configured in the test env (S3_ENDPOINT=''
 * via playwright.config), so an authorised upload deterministically hits the 503
 * "not configured" branch rather than a real bucket — enough to pin the auth
 * boundary and graceful degradation without standing up MinIO in CI.
 */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

function filePayload() {
  return { file: { name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1PX } }
}

test.describe('avatar API', () => {
  test('rejects anonymous upload with 401', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).post('/api/me/avatar', { multipart: filePayload() })
    expect(res.status()).toBe(401)
  })

  test('lets a plain member past the gate (503 when storage is unconfigured)', async ({ apiAs }) => {
    // The decisive difference from /api/uploads, which 403s a plain member.
    const res = await (await apiAs('member')).post('/api/me/avatar', { multipart: filePayload() })
    expect(res.status()).toBe(503)
  })

  test('rejects anonymous removal with 401', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).delete('/api/me/avatar')
    expect(res.status()).toBe(401)
  })

  test('a member can remove their own picture (idempotent when none set)', async ({ apiAs }) => {
    const res = await (await apiAs('member')).delete('/api/me/avatar')
    expect(res.status()).toBe(200)
    expect(await res.json()).toMatchObject({ avatarKey: null, avatarUrl: null })
  })
})
