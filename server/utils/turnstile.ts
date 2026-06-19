import type { H3Event } from 'h3'
import { getSetting } from './settings'

/** Cloudflare's server-side token verification endpoint. */
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Resolve the Turnstile secret key. Prefers the admin-only `settings` row
 * (`turnstile.secret_key`) and falls back to the `TURNSTILE_SECRET_KEY` env var,
 * so a deployment can inject it either way — secrets never live in code
 * (CLAUDE.md). Empty when neither is set, which means CAPTCHA is unconfigured.
 */
async function getTurnstileSecret(): Promise<string> {
  const fromSettings = await getSetting('turnstile.secret_key')
  return (fromSettings || process.env.TURNSTILE_SECRET_KEY || '').trim()
}

/** Whether Turnstile verification is configured (a secret key is present). */
export async function isTurnstileConfigured(): Promise<boolean> {
  return Boolean(await getTurnstileSecret())
}

interface SiteVerifyResponse {
  'success': boolean
  'error-codes'?: string[]
}

/**
 * Verify a Turnstile response token with Cloudflare. Returns true only on a
 * confirmed success. Any network/parse failure is treated as a failed
 * verification (fail-closed) so a flaky CAPTCHA service can't wave bots through.
 */
export async function verifyTurnstileToken(token: string, secret: string, remoteIp?: string): Promise<boolean> {
  const form = new URLSearchParams()
  form.set('secret', secret)
  form.set('response', token)
  if (remoteIp) form.set('remoteip', remoteIp)

  try {
    const res = await $fetch<SiteVerifyResponse>(SITEVERIFY_URL, { method: 'POST', body: form })
    return res.success === true
  }
  catch (e) {
    console.error('[turnstile] siteverify request failed:', e instanceof Error ? e.message : e)
    return false
  }
}

/**
 * Gate an unauthenticated, abuse-prone endpoint (register, password reset)
 * behind Turnstile.
 *
 * - **Unconfigured** (no secret): a graceful bypass — logs a dev stub and
 *   returns, mirroring the email stub so the app runs end-to-end locally and in
 *   tests without a CAPTCHA provider.
 * - **Configured**: a valid token is mandatory — a missing or invalid token is
 *   rejected with a 400 before any account is created or email is sent.
 */
export async function requireTurnstile(event: H3Event, token: unknown): Promise<void> {
  const secret = await getTurnstileSecret()
  if (!secret) {
    console.info('\n🤖 [turnstile stub] (no secret configured) — skipping CAPTCHA verification\n')
    return
  }

  const response = typeof token === 'string' ? token.trim() : ''
  if (!response) {
    throw createError({ statusCode: 400, statusMessage: 'CAPTCHA verification required' })
  }

  const remoteIp = getRequestIP(event, { xForwardedFor: true })
  const ok = await verifyTurnstileToken(response, secret, remoteIp)
  if (!ok) {
    throw createError({ statusCode: 400, statusMessage: 'CAPTCHA verification failed' })
  }
}
