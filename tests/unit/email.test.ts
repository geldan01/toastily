import { describe, expect, it } from 'vitest'
import { emailDeliveryMode } from '../../server/utils/email-service'

/**
 * Email delivery requires BOTH a Resend API key and a from-address (PRD §10).
 * The classic production failure (issue #28) is setting only the key: the app
 * then silently logs a stub instead of sending. `emailDeliveryMode` is the pure
 * decision that distinguishes a healthy dev stub from a half-finished prod
 * config, so the latter can be surfaced loudly. The DB/Resend wiring around it
 * lives in `sendEmail` and is exercised at the integration layer.
 */
describe('emailDeliveryMode', () => {
  it('sends live only when both key and from-address are present', () => {
    expect(emailDeliveryMode('re_123', 'club <no-reply@club.org>')).toBe('live')
  })

  it('treats no config as a benign dev stub', () => {
    expect(emailDeliveryMode('', '')).toBe('stub')
  })

  it('flags a key without a from-address as misconfigured', () => {
    expect(emailDeliveryMode('re_123', '')).toBe('misconfigured')
  })

  it('flags a from-address without a key as misconfigured', () => {
    expect(emailDeliveryMode('', 'club <no-reply@club.org>')).toBe('misconfigured')
  })

  it('ignores whitespace-only values (treated as absent)', () => {
    expect(emailDeliveryMode('  ', '  ')).toBe('stub')
    expect(emailDeliveryMode('re_123', '   ')).toBe('misconfigured')
  })
})
