import { describe, expect, it } from 'vitest'
import { extractUploadKeys, indexUploadUsage, type UploadRef } from '../../server/utils/upload-usage'

/**
 * Pure provenance scanning for the admin media library (issue #78). The S3
 * listing and DB gathering are exercised at the integration layer; here we pin
 * the key-extraction and usage-indexing that decide where each image is "used"
 * and which objects are orphans. References embed the full object key verbatim —
 * as a raw avatar key, the proxy path, or a bucket URL — and all three forms
 * must resolve to the same key.
 */
const KEY_A = 'uploads/2026/05/11111111-2222-3333-4444-555555555555.png'
const KEY_B = 'uploads/2026/04/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg'

describe('extractUploadKeys', () => {
  it('finds a raw key (avatar form)', () => {
    expect(extractUploadKeys(KEY_A)).toEqual([KEY_A])
  })

  it('finds a key inside the Nitro proxy path', () => {
    expect(extractUploadKeys(`<img src="/api/uploads/${KEY_A}">`)).toEqual([KEY_A])
  })

  it('finds a key inside a bucket URL', () => {
    expect(extractUploadKeys(`https://cdn.example.com/${KEY_A}`)).toEqual([KEY_A])
  })

  it('finds multiple distinct keys and de-duplicates', () => {
    const text = `${KEY_A} ... ${KEY_B} ... ${KEY_A}`
    expect(extractUploadKeys(text).sort()).toEqual([KEY_B, KEY_A].sort())
  })

  it('returns nothing for empty / null / unrelated text', () => {
    expect(extractUploadKeys(null)).toEqual([])
    expect(extractUploadKeys(undefined)).toEqual([])
    expect(extractUploadKeys('')).toEqual([])
    expect(extractUploadKeys('no images here')).toEqual([])
  })
})

describe('indexUploadUsage', () => {
  it('maps each key to the records that reference it', () => {
    const refs: UploadRef[] = [
      { kind: 'avatar', label: 'Jane Doe', ref: 'u1', text: KEY_A },
      { kind: 'news', label: 'Big news', ref: 'n1', text: `cover ${KEY_A}\nbody ${KEY_B}` },
      { kind: 'page', label: 'About', ref: 'about', text: 'no images' },
    ]
    const map = indexUploadUsage(refs)

    expect(map.get(KEY_A)).toEqual([
      { kind: 'avatar', label: 'Jane Doe', ref: 'u1' },
      { kind: 'news', label: 'Big news', ref: 'n1' },
    ])
    expect(map.get(KEY_B)).toEqual([
      { kind: 'news', label: 'Big news', ref: 'n1' },
    ])
  })

  it('omits keys that are never referenced (orphans absent from the map)', () => {
    const map = indexUploadUsage([{ kind: 'page', label: 'About', ref: 'about', text: 'nothing' }])
    expect(map.has(KEY_A)).toBe(false)
    expect(map.size).toBe(0)
  })
})
