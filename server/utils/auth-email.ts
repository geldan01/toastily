import { randomBytes } from 'node:crypto'
import { schema, useDrizzle } from '../db/client'

type TokenType = 'verify' | 'reset'

const TTL_MINUTES: Record<TokenType, number> = {
  verify: 60 * 24, // 24h
  reset: 60, // 1h
}

/** Create a single-use email token row and return its opaque value. */
export async function createEmailToken(userId: string, type: TokenType): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + TTL_MINUTES[type] * 60 * 1000)
  await useDrizzle().insert(schema.emailTokens).values({ userId, type, token, expiresAt })
  return token
}

function siteUrl(): string {
  return process.env.SITE_URL || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

export function buildAuthLink(type: TokenType, token: string): string {
  const path = type === 'verify' ? '/verify' : '/reset-password'
  return `${siteUrl()}${path}?token=${token}`
}

/**
 * Deliver an auth link to the user.
 *
 * DEV STUB (P2): logs the link to the server console so you can click it
 * locally with no email provider. Real Resend delivery is wired in P7
 * (§10 email templates) — replace the body of this function then.
 */
export async function deliverAuthLink(type: TokenType, email: string, link: string): Promise<void> {
  console.info(
    `\n📧 [dev email stub] ${type === 'verify' ? 'Verify account' : 'Password reset'} for ${email}\n   ${link}\n`,
  )
}
