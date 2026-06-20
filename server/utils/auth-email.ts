import { randomBytes } from 'node:crypto'
import { schema, useDrizzle } from '../db/client'
import { sendEmail } from './email-service'
import { getSetting } from './settings'

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

/** Club name + brand palette + logo, resolved from the `settings` table. */
interface Branding {
  clubName: string
  maroon: string
  navy: string
  gold: string
  gray: string
  logoUrl: string
}

async function loadBranding(): Promise<Branding> {
  const [clubName, maroon, navy, gold, gray, logo] = await Promise.all([
    getSetting('club.name'),
    getSetting('branding.maroon'),
    getSetting('branding.navy'),
    getSetting('branding.gold'),
    getSetting('branding.gray'),
    getSetting('branding.logo_url'),
  ])
  // Email images need an absolute URL — a stored relative path is resolved
  // against the public site URL.
  const rawLogo = logo || ''
  const logoUrl = rawLogo && !/^https?:\/\//.test(rawLogo) ? `${siteUrl()}${rawLogo}` : rawLogo
  return {
    clubName: clubName || 'Toastmasters',
    maroon: maroon || '#772432',
    navy: navy || '#004165',
    gold: gold || '#F2DF74',
    gray: gray || '#A9B2B1',
    logoUrl,
  }
}

function escapeAttr(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/**
 * Wrap one or both language blocks in a branded, email-client-safe shell:
 * a navy header bar carrying the Toastmasters logo + club name, a white card
 * body, and a footer. Table-based layout with inline styles for broad
 * compatibility (Gmail/Outlook strip <style> and external CSS).
 */
function brandedShell(b: Branding, bodyHtml: string): string {
  const safeClub = escapeAttr(b.clubName)
  const logo = b.logoUrl
    ? `<img src="${escapeAttr(b.logoUrl)}" alt="${safeClub}" width="56" height="56" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;">`
    : ''
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td align="center" style="background:${b.navy};padding:28px 24px;">
            ${logo}
            <div style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;letter-spacing:0.3px;">${safeClub}</div>
          </td>
        </tr>
        <tr><td style="height:4px;background:${b.gold};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:32px 32px 24px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:15px;line-height:1.6;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;color:${b.gray};font-size:12px;line-height:1.5;">
            ${safeClub} · Toastmasters International
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** A maroon, email-safe CTA button (bulletproof table button). */
function ctaButton(b: Branding, link: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 4px;">
    <tr><td align="center" bgcolor="${b.maroon}" style="border-radius:8px;">
      <a href="${escapeAttr(link)}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    </td></tr>
  </table>`
}

/** Bilingual subject + branded HTML body for an auth link (EN then FR). */
async function authLinkEmail(type: TokenType, link: string): Promise<{ subject: string, html: string }> {
  const b = await loadBranding()
  const club = escapeAttr(b.clubName)
  const divider = `<tr><td style="padding:24px 0;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>`
  const fallbackHint = (label: string) =>
    `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">${label}<br><a href="${escapeAttr(link)}" style="color:${b.navy};word-break:break-all;">${escapeAttr(link)}</a></p>`

  if (type === 'verify') {
    const en = `
      <h1 style="margin:0 0 14px;font-size:20px;color:${b.navy};">Welcome to ${club}!</h1>
      <p style="margin:0 0 14px;">Thank you for creating an account. ${club} is part of Toastmasters International, a worldwide community where members build confidence in public speaking and leadership in a friendly, supportive setting.</p>
      <p style="margin:0 0 20px;">To activate your account and access meetings, agendas, and member features, please confirm your email address:</p>
      ${ctaButton(b, link, 'Confirm my account')}
      <p style="margin:18px 0 0;font-size:13px;color:#6b7280;">This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
      ${fallbackHint('Button not working? Copy and paste this link into your browser:')}`
    const fr = `
      <h1 style="margin:0 0 14px;font-size:20px;color:${b.navy};">Bienvenue au ${club}!</h1>
      <p style="margin:0 0 14px;">Merci d'avoir créé un compte. ${club} fait partie de Toastmasters International, une communauté mondiale où les membres développent leur confiance en prise de parole en public et en leadership, dans un cadre convivial et bienveillant.</p>
      <p style="margin:0 0 20px;">Pour activer votre compte et accéder aux réunions, aux ordres du jour et aux fonctions réservées aux membres, veuillez confirmer votre adresse courriel :</p>
      ${ctaButton(b, link, 'Confirmer mon compte')}
      <p style="margin:18px 0 0;font-size:13px;color:#6b7280;">Ce lien expire dans 24 heures. Si vous n'avez pas créé ce compte, vous pouvez ignorer ce courriel.</p>
      ${fallbackHint('Le bouton ne fonctionne pas? Copiez et collez ce lien dans votre navigateur :')}`
    return {
      subject: `Confirm your account · Confirmez votre compte — ${b.clubName}`,
      html: brandedShell(b, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>${en}</td></tr>${divider}<tr><td>${fr}</td></tr></table>`),
    }
  }

  const en = `
    <h1 style="margin:0 0 14px;font-size:20px;color:${b.navy};">Reset your password</h1>
    <p style="margin:0 0 20px;">We received a request to reset the password for your ${club} account. Click the button below to choose a new one. If you didn't request this, you can safely ignore this email — your password won't change.</p>
    ${ctaButton(b, link, 'Reset my password')}
    <p style="margin:18px 0 0;font-size:13px;color:#6b7280;">This link expires in 1 hour for your security.</p>
    ${fallbackHint('Button not working? Copy and paste this link into your browser:')}`
  const fr = `
    <h1 style="margin:0 0 14px;font-size:20px;color:${b.navy};">Réinitialisez votre mot de passe</h1>
    <p style="margin:0 0 20px;">Nous avons reçu une demande de réinitialisation du mot de passe de votre compte ${club}. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Si vous n'avez pas fait cette demande, vous pouvez ignorer ce courriel — votre mot de passe ne changera pas.</p>
    ${ctaButton(b, link, 'Réinitialiser mon mot de passe')}
    <p style="margin:18px 0 0;font-size:13px;color:#6b7280;">Ce lien expire dans 1 heure pour votre sécurité.</p>
    ${fallbackHint('Le bouton ne fonctionne pas? Copiez et collez ce lien dans votre navigateur :')}`
  return {
    subject: `Reset your password · Réinitialisez votre mot de passe — ${b.clubName}`,
    html: brandedShell(b, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>${en}</td></tr>${divider}<tr><td>${fr}</td></tr></table>`),
  }
}

/**
 * Deliver an auth link to the user via Resend (PRD §10). When no Resend key is
 * configured (e.g. local dev), `sendEmail` falls back to a console log stub so
 * the link is still clickable locally with no email provider. Bodies are
 * bilingual (EN + FR) since the recipient's locale isn't always known here.
 */
export async function deliverAuthLink(type: TokenType, email: string, link: string): Promise<void> {
  const { subject, html } = await authLinkEmail(type, link)
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
