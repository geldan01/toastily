import { describe, expect, it } from 'vitest'
import {
  generateImageKey,
  isStorageConfigured,
  publicUrlForKey,
  validateImageUpload,
  type S3Config,
} from '../../server/utils/s3'

/**
 * Pure helpers behind the S3 image-upload backend (issue #10, PRD §2/§15). The
 * S3 wiring itself (PutObject/GetObject, auth gating) is exercised at the
 * integration layer; here we pin the validation, key generation and public-URL
 * logic that decide what gets stored and how it's addressed.
 */
const CFG: S3Config = {
  endpoint: 'http://minio:9000',
  region: 'us-east-1',
  bucket: 'toastily-uploads',
  accessKey: 'key',
  secretKey: 'secret',
  forcePathStyle: true,
  publicBaseUrl: '',
  maxBytes: 5 * 1024 * 1024,
}

describe('isStorageConfigured', () => {
  it('is true only when endpoint, bucket and both keys are present', () => {
    expect(isStorageConfigured(CFG)).toBe(true)
    expect(isStorageConfigured({ ...CFG, endpoint: '' })).toBe(false)
    expect(isStorageConfigured({ ...CFG, bucket: '' })).toBe(false)
    expect(isStorageConfigured({ ...CFG, accessKey: '' })).toBe(false)
    expect(isStorageConfigured({ ...CFG, secretKey: '' })).toBe(false)
  })
})

describe('validateImageUpload', () => {
  it('returns the canonical extension for allowed image types', () => {
    expect(validateImageUpload('image/jpeg', 1000, CFG)).toBe('jpg')
    expect(validateImageUpload('image/png', 1000, CFG)).toBe('png')
    expect(validateImageUpload('image/webp', 1000, CFG)).toBe('webp')
  })

  it('ignores charset/parameters and casing on the content-type', () => {
    expect(validateImageUpload('IMAGE/PNG; charset=binary', 1000, CFG)).toBe('png')
  })

  it('rejects non-image types with 415', () => {
    expect(() => validateImageUpload('application/pdf', 1000, CFG)).toThrowError(/Unsupported/)
    expect(() => validateImageUpload(undefined, 1000, CFG)).toThrowError(/Unsupported/)
  })

  it('rejects empty files with 400', () => {
    expect(() => validateImageUpload('image/png', 0, CFG)).toThrowError(/Empty/)
  })

  it('rejects files over the size limit with 413', () => {
    expect(() => validateImageUpload('image/png', CFG.maxBytes + 1, CFG)).toThrowError(/too large/)
  })
})

describe('generateImageKey', () => {
  it('partitions by UTC year/month and carries the extension', () => {
    const key = generateImageKey('jpg', new Date('2026-03-09T12:00:00Z'))
    expect(key).toMatch(/^uploads\/2026\/03\/[0-9a-f-]{36}\.jpg$/)
  })

  it('produces a unique key per call', () => {
    expect(generateImageKey('png')).not.toBe(generateImageKey('png'))
  })
})

describe('publicUrlForKey', () => {
  it('proxies through Nitro when no public base URL is set', () => {
    expect(publicUrlForKey('uploads/2026/03/abc.jpg', CFG)).toBe('/api/uploads/uploads/2026/03/abc.jpg')
  })

  it('uses the bucket URL directly when configured, trimming a trailing slash', () => {
    const cfg = { ...CFG, publicBaseUrl: 'https://cdn.example.org/' }
    expect(publicUrlForKey('uploads/x.jpg', cfg)).toBe('https://cdn.example.org/uploads/x.jpg')
  })
})
