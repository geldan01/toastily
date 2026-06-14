import { randomBytes } from 'node:crypto'
import { schema, useDrizzle } from '../db/client'
import { sendEmail } from './email-service'

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

/** Bilingual subject + HTML body for an auth link (EN then FR). */
function authLinkEmail(type: TokenType, link: string): { subject: string, html: string } {
  if (type === 'verify') {
    return {
      subject: 'Confirm your account · Confirmez votre compte',
      html: `
        <p>Welcome! Please confirm your account by clicking the link below.</p>
        <p><a href="${link}">Confirm my account</a></p>
        <hr>
        <p>Bienvenue! Veuillez confirmer votre compte en cliquant sur le lien ci-dessous.</p>
        <p><a href="${link}">Confirmer mon compte</a></p>
        <p style="color:#888;font-size:12px">${link}</p>`,
    }
  }
  return {
    subject: 'Reset your password · Réinitialisez votre mot de passe',
    html: `
      <p>We received a request to reset your password. Click the link below to choose a new one. If you didn't request this, you can ignore this email.</p>
      <p><a href="${link}">Reset my password</a></p>
      <hr>
      <p>Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le lien ci-dessous pour en choisir un nouveau. Si vous n'avez pas fait cette demande, ignorez ce courriel.</p>
      <p><a href="${link}">Réinitialiser mon mot de passe</a></p>
      <p style="color:#888;font-size:12px">${link}</p>`,
  }
}

/**
 * Deliver an auth link to the user via Resend (PRD §10). When no Resend key is
 * configured (e.g. local dev), `sendEmail` falls back to a console log stub so
 * the link is still clickable locally with no email provider. Bodies are
 * bilingual (EN + FR) since the recipient's locale isn't always known here.
 */
export async function deliverAuthLink(type: TokenType, email: string, link: string): Promise<void> {
  const { subject, html } = authLinkEmail(type, link)
  const result = await sendEmail({ to: email, subject, html })
  // Keep the clickable link in the dev console when delivery is genuinely
  // stubbed (local dev, no provider). Don't print it for a misconfigured
  // prod setup — email-service already logs a loud warning there.
  if (result.stubbed && result.mode === 'stub') {
    console.info(
      `\n📧 [dev email stub] ${type === 'verify' ? 'Verify account' : 'Password reset'} for ${email}\n   ${link}\n`,
    )
  }
  // A real delivery failure (key+from set, but Resend rejected it) must be
  // visible — registration/reset still succeeds so we don't block the user.
  else if (!result.ok) {
    console.error(
      `Failed to deliver ${type} email to ${email}: ${result.error ?? 'unknown error'}`,
    )
  }
}
