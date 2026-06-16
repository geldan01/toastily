import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '../fixtures/roles'
import { TEST_ACCOUNTS } from '../setup/accounts'

/**
 * Member testimonials contract (issue #27, PRD §2/§5). Members+ author a
 * per-language testimonial via `/api/me/testimonial`; a content curator
 * (admin / content-managing exec / `content_edit` grant) reviews and features
 * them via `/api/admin/testimonials`; the public landing page reads only the
 * featured, non-empty rows from `/api/testimonials/featured`.
 *
 * Capability note: the seeded `officer` account holds NO content capability by
 * default (content comes from an exec position / grant — see content-api and
 * permission-grants specs), so the privileged path here uses the `admin`
 * fixture and the `member` fixture asserts the 403 boundary on the admin
 * endpoints — mirroring how the other content/admin specs pick their roles.
 *
 * These specs mutate the shared seeded `*_test` DB. They are written to be
 * idempotent and self-cleaning: each clears the testimonial it created (and
 * un-features it) so the seed state is left untouched for other specs, and they
 * assert on the *specific* members they create rather than on exact array
 * lengths (other rows may exist).
 */

// Every block here mutates the same per-user testimonial rows (`member` /
// `officer` — unique per userId), so they must not interleave under the
// project's `fullyParallel` setting. Serialize the whole file.
test.describe.configure({ mode: 'serial' })

interface AdminRow {
  id: string
  userId: string
  name: string
  email: string
  bodyEn: string | null
  bodyFr: string | null
  featuredEn: boolean
  featuredFr: boolean
}

interface FeaturedRow {
  id: string
  name: string
  body: string
}

/** Find a member's testimonial row in the admin curation list by email. */
async function adminRowByEmail(admin: APIRequestContext, email: string): Promise<AdminRow> {
  const res = await admin.get('/api/admin/testimonials')
  expect(res.status()).toBe(200)
  const { testimonials } = (await res.json()) as { testimonials: AdminRow[] }
  const row = testimonials.find(r => r.email === email)
  expect(row, `${email} should appear in the admin testimonials list`).toBeTruthy()
  return row!
}

/** Reset a member's testimonial to blank (also clears any featured flags). */
async function clearTestimonial(api: APIRequestContext) {
  await api.put('/api/me/testimonial', { data: { bodyEn: '', bodyFr: '' } })
}

test.describe('testimonials API — auth boundary', () => {
  test('anonymous callers get 401 from the member testimonial endpoints', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    expect((await guest.get('/api/me/testimonial')).status()).toBe(401)
    expect((await guest.put('/api/me/testimonial', { data: { bodyEn: 'x' } })).status()).toBe(401)
  })

  test('anonymous callers get 401 from the admin/curation endpoints', async ({ apiAs }) => {
    const guest = await apiAs('guest')
    expect((await guest.get('/api/admin/testimonials')).status()).toBe(401)
    expect((await guest.patch('/api/admin/testimonials/whatever', { data: {} })).status()).toBe(401)
    expect((await guest.post('/api/admin/testimonials/reorder', { data: {} })).status()).toBe(401)
  })

  test('a plain member is refused with 403 from the admin/curation endpoints', async ({ apiAs }) => {
    const member = await apiAs('member')
    expect((await member.get('/api/admin/testimonials')).status()).toBe(403)
    expect((await member.patch('/api/admin/testimonials/whatever', { data: {} })).status()).toBe(403)
    expect((await member.post('/api/admin/testimonials/reorder', { data: {} })).status()).toBe(403)
  })
})

test.describe('testimonials API — member round-trip', () => {
  test('a member saves both languages, reads them back, then clears English', async ({ apiAs }) => {
    const member = await apiAs('member')
    const bodyEn = `My round-trip EN ${Date.now()}`
    const bodyFr = `Mon témoignage FR ${Date.now()}`

    try {
      const put = await member.put('/api/me/testimonial', { data: { bodyEn, bodyFr } })
      expect(put.status()).toBe(200)
      expect(await put.json()).toMatchObject({ bodyEn, bodyFr, featuredEn: false, featuredFr: false })

      const get = await member.get('/api/me/testimonial')
      expect(get.status()).toBe(200)
      expect(await get.json()).toMatchObject({ bodyEn, bodyFr })

      // Clearing one language only ⇒ that body becomes null, the other is kept.
      const cleared = await member.put('/api/me/testimonial', { data: { bodyEn: '', bodyFr } })
      expect(cleared.status()).toBe(200)
      const clearedBody = await cleared.json()
      expect(clearedBody.bodyEn).toBeNull()
      expect(clearedBody.bodyFr).toBe(bodyFr)
    }
    finally {
      await clearTestimonial(member)
    }
  })
})

test.describe('testimonials API — public featured endpoint', () => {
  test('is public and returns { en: [], fr: [] } arrays', async ({ apiAs }) => {
    const res = await (await apiAs('guest')).get('/api/testimonials/featured')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.en)).toBe(true)
    expect(Array.isArray(body.fr)).toBe(true)
  })
})

/**
 * Curation happy path, the 422 guard and the re-approval policy. Serial so the
 * testimonial authored in the first step carries through; the cleanup in the
 * final step (with an afterAll safety net) restores the blank/un-featured seed
 * state for the `member` account.
 */
test.describe.serial('testimonials API — curation lifecycle', () => {
  const bodyEn = `Curated EN ${Date.now()}`
  let testimonialId = ''

  test.afterAll(async ({ apiAs }) => {
    await clearTestimonial(await apiAs('member'))
  })

  test('admin features a member testimonial → it surfaces publicly with the right body + name', async ({ apiAs }) => {
    const member = await apiAs('member')
    const admin = await apiAs('admin')

    // Author an EN-only testimonial as the member.
    const put = await member.put('/api/me/testimonial', { data: { bodyEn, bodyFr: '' } })
    expect(put.status()).toBe(200)

    // Resolve the row via the admin curation list, keyed by the member's email.
    const row = await adminRowByEmail(admin, TEST_ACCOUNTS.member.email)
    testimonialId = row.id
    expect(row.bodyEn).toBe(bodyEn)
    expect(row.featuredEn).toBe(false)

    // Feature the English language.
    const patch = await admin.patch(`/api/admin/testimonials/${testimonialId}`, {
      data: { featuredEn: true },
    })
    expect(patch.status()).toBe(200)
    expect((await patch.json()).testimonial).toMatchObject({ id: testimonialId, featuredEn: true })

    // The member now appears in the public featured EN list with body + name.
    const featured = await (await apiAs('guest')).get('/api/testimonials/featured')
    const { en } = (await featured.json()) as { en: FeaturedRow[] }
    const mine = en.find(q => q.id === testimonialId)
    expect(mine, 'featured EN list should include the just-featured testimonial').toBeTruthy()
    expect(mine!.body).toBe(bodyEn)
    expect(mine!.name).toBe(TEST_ACCOUNTS.member.name)
  })

  test('featuring a language whose body is empty → 422', async ({ apiAs }) => {
    const admin = await apiAs('admin')
    // The member authored EN only above, so bodyFr is empty ⇒ cannot feature FR.
    const res = await admin.patch(`/api/admin/testimonials/${testimonialId}`, {
      data: { featuredFr: true },
    })
    expect(res.status()).toBe(422)
  })

  test('editing a featured body resets that language\'s featured flag (re-approval)', async ({ apiAs }) => {
    const member = await apiAs('member')
    const changed = `${bodyEn} (edited ${Date.now()})`

    const put = await member.put('/api/me/testimonial', { data: { bodyEn: changed, bodyFr: '' } })
    expect(put.status()).toBe(200)
    expect((await put.json()).featuredEn).toBe(false)

    // GET confirms the flag is now off.
    const get = await member.get('/api/me/testimonial')
    expect((await get.json()).featuredEn).toBe(false)

    // And the member drops out of the public featured EN list.
    const featured = await (await apiAs('guest')).get('/api/testimonials/featured')
    const { en } = (await featured.json()) as { en: FeaturedRow[] }
    expect(en.find(q => q.id === testimonialId)).toBeUndefined()
  })
})

/**
 * Reorder persists the curator's ordering of the featured EN list. Features the
 * `member` and `officer` accounts (both plain members content-wise), reverses
 * the order, and asserts the public list reflects it. Self-cleaning afterwards.
 */
test.describe.serial('testimonials API — featured reorder', () => {
  const memberBody = `Reorder member EN ${Date.now()}`
  const officerBody = `Reorder officer EN ${Date.now()}`
  let memberTid = ''
  let officerTid = ''

  test.afterAll(async ({ apiAs }) => {
    await clearTestimonial(await apiAs('member'))
    await clearTestimonial(await apiAs('officer'))
  })

  test('reordering the featured EN ids reflects in the public list', async ({ apiAs }) => {
    const admin = await apiAs('admin')

    // Author + feature two distinct members in English.
    await (await apiAs('member')).put('/api/me/testimonial', { data: { bodyEn: memberBody, bodyFr: '' } })
    await (await apiAs('officer')).put('/api/me/testimonial', { data: { bodyEn: officerBody, bodyFr: '' } })

    memberTid = (await adminRowByEmail(admin, TEST_ACCOUNTS.member.email)).id
    officerTid = (await adminRowByEmail(admin, TEST_ACCOUNTS.officer.email)).id

    expect((await admin.patch(`/api/admin/testimonials/${memberTid}`, { data: { featuredEn: true } })).status()).toBe(200)
    expect((await admin.patch(`/api/admin/testimonials/${officerTid}`, { data: { featuredEn: true } })).status()).toBe(200)

    // Read the current relative order of our two rows in the public list.
    const orderOf = async () => {
      const featured = await (await apiAs('guest')).get('/api/testimonials/featured')
      const { en } = (await featured.json()) as { en: FeaturedRow[] }
      return en.map(q => q.id).filter(id => id === memberTid || id === officerTid)
    }

    const before = await orderOf()
    expect(before).toHaveLength(2)

    // Persist the reversed order of just our two ids.
    const reversed = [...before].reverse()
    const reorder = await admin.post('/api/admin/testimonials/reorder', {
      data: { locale: 'en', ids: reversed },
    })
    expect(reorder.status()).toBe(200)
    expect(await reorder.json()).toEqual({ ok: true })

    // The public list now reflects the reversed relative order.
    const after = await orderOf()
    expect(after).toEqual(reversed)
    expect(after).not.toEqual(before)
  })
})
