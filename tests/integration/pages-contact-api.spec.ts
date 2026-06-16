import { expect, test } from '../fixtures/roles'

/**
 * Rich pages + contact form API contract (issue #16, PRD §5.2/§12).
 *
 * Pages (About/FAQ) are public to read but editable only via the content-edit
 * capability (`effectiveCapabilities`) — admins always; plain members/officers
 * without a content position are refused. Publishing enforces the both-locales
 * rule server-side, and the public read API only surfaces published pages.
 *
 * The contact form is public; with no Resend key in the test env the send is
 * stubbed, so a well-formed submission deterministically returns ok.
 */
const BODY = JSON.stringify({ blocks: [{ type: 'paragraph', data: { text: 'Hello world.' } }] })

test.describe('pages API — auth boundary', () => {
  test('anonymous callers get 401 on the editor read', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).get('/api/admin/pages/about')
    expect(res.status()).toBe(401)
  })

  test('a plain member is refused with 403', async ({ apiAs }) => {
    const res = await (await apiAs('member')).put('/api/admin/pages/about', { data: {} })
    expect(res.status()).toBe(403)
  })

  test('a plain officer (no content position) is refused with 403', async ({ apiAs }) => {
    const res = await (await apiAs('officer')).put('/api/admin/pages/about', { data: {} })
    expect(res.status()).toBe(403)
  })

  test('the seeded About page is publicly readable', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).get('/api/pages/about')
    expect(res.status()).toBe(200)
    const { page } = await res.json()
    expect(page).toBeTruthy()
    expect(page.titleEn).toBeTruthy()
    expect(page.titleFr).toBeTruthy()
  })

  test('an unknown slug 404s', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).get('/api/pages/bogus')
    expect(res.status()).toBe(404)
  })
})

test.describe.serial('pages API — edit lifecycle', () => {
  // Exercise the FAQ slug so the About auth-boundary tests above stay stable.
  test('admin can read the draft row', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).get('/api/admin/pages/faq')
    expect(res.status()).toBe(200)
    const { page } = await res.json()
    expect(page.slug).toBe('faq')
  })

  test('publishing is blocked while a locale is incomplete (422)', async ({ apiAs }) => {
    // Only the English side is provided, with published requested.
    const res = await (await apiAs('admin')).put('/api/admin/pages/faq', {
      data: { titleEn: 'FAQ', contentEn: BODY, published: true },
    })
    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.data.missing).toContain('titleFr')
    expect(body.data.missing).toContain('contentFr')
  })

  test('saving as an unpublished draft hides it from the public read', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).put('/api/admin/pages/faq', {
      data: { titleEn: 'FAQ', titleFr: 'FAQ', contentEn: BODY, contentFr: BODY, published: false },
    })
    expect(res.status()).toBe(200)
    const { page } = await (await (await apiAs('guest')).get('/api/pages/faq')).json()
    expect(page).toBeNull()
  })

  test('publishing succeeds once both locales are complete', async ({ apiAs }) => {
    const res = await (await apiAs('admin')).put('/api/admin/pages/faq', {
      data: { titleEn: 'FAQ', titleFr: 'FAQ', contentEn: BODY, contentFr: BODY, published: true },
    })
    expect(res.status()).toBe(200)
    const { page } = await res.json()
    expect(page.published).toBe(true)
    // Now visible publicly.
    const pub = await (await (await apiAs('guest')).get('/api/pages/faq')).json()
    expect(pub.page).toBeTruthy()
  })
})

test.describe('contact API', () => {
  test('a well-formed submission is accepted', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).post('/api/contact', {
      data: { name: 'Pat Visitor', email: 'pat@example.com', message: 'Can I visit a meeting?' },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  test('missing fields are rejected with 400', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).post('/api/contact', {
      data: { name: 'Pat', email: 'pat@example.com' },
    })
    expect(res.status()).toBe(400)
  })

  test('an invalid email is rejected with 400', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).post('/api/contact', {
      data: { name: 'Pat', email: 'not-an-email', message: 'Hi' },
    })
    expect(res.status()).toBe(400)
  })

  test('a tripped honeypot is silently accepted without error', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).post('/api/contact', {
      data: { name: 'Bot', email: 'bot@example.com', message: 'spam', company: 'Spammer Inc' },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })
})
