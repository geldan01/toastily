import { expect, test } from '../fixtures/roles'

/**
 * News authoring API contract (issue #12, PRD §5.3/§12). Authoring is gated on
 * the content-edit capability (`effectiveCapabilities`) — admins always; plain
 * members/officers without a content position are refused. Publishing enforces
 * the both-locales rule server-side, and the public read API only surfaces
 * published articles.
 */
const BODY = JSON.stringify({ blocks: [{ type: 'paragraph', data: { text: 'Hello world.' } }] })

test.describe('news admin API — auth boundary', () => {
  test('anonymous callers get 401', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).get('/api/admin/news')
    expect(res.status()).toBe(401)
  })

  test('a plain member is refused with 403', async ({ apiAs }) => {
    const res = await (await apiAs('member')).post('/api/admin/news', { data: {} })
    expect(res.status()).toBe(403)
  })

  test('a plain officer (no content position) is refused with 403', async ({ apiAs }) => {
    const res = await (await apiAs('officer')).post('/api/admin/news', { data: {} })
    expect(res.status()).toBe(403)
  })
})

test.describe.serial('news admin API — authoring lifecycle', () => {
  let id = ''

  test.afterAll(async ({ apiAs }) => {
    if (id) await (await apiAs('admin')).delete(`/api/admin/news/${id}`)
  })

  test('admin creates a blank draft', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).post('/api/admin/news', { data: {} })
    expect(res.status()).toBe(200)
    const { article } = await res.json()
    expect(article.id).toBeTruthy()
    expect(article.publishedAt).toBeNull()
    id = article.id
  })

  test('publishing is blocked while a locale is incomplete (422)', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    // Only the English side is filled in.
    await admin.patch(`/api/admin/news/${id}`, { data: { titleEn: 'Title', contentEn: BODY } })
    const res = await admin.post(`/api/admin/news/${id}/publish`)
    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.data.missing).toContain('titleFr')
    expect(body.data.missing).toContain('contentFr')
  })

  test('the draft is absent from the public list', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).get('/api/news')
    const list = await res.json()
    expect(list.find((n: { id: string }) => n.id === id)).toBeUndefined()
  })

  test('publishing succeeds once both locales are complete', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    await admin.patch(`/api/admin/news/${id}`, { data: { titleFr: 'Titre', contentFr: BODY } })
    const res = await admin.post(`/api/admin/news/${id}/publish`)
    expect(res.status()).toBe(200)
    const { article } = await res.json()
    expect(article.publishedAt).not.toBeNull()
  })

  test('a published article appears on the public list and detail', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    const list = await (await guest.get('/api/news')).json()
    expect(list.find((n: { id: string }) => n.id === id)).toBeTruthy()
    const detail = await guest.get(`/api/news/${id}`)
    expect(detail.status()).toBe(200)
  })

  test('unpublishing removes it from the public list again', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).post(`/api/admin/news/${id}/unpublish`)
    expect(res.status()).toBe(200)
    const list = await (await (await apiAs('guest')).get('/api/news')).json()
    expect(list.find((n: { id: string }) => n.id === id)).toBeUndefined()
  })
})
