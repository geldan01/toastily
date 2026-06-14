import { Resend } from 'resend'
import { getSetting } from './settings'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  text?: string
  /** Override the configured from-address (rarely needed). */
  from?: string
}

export interface SendEmailResult {
  ok: boolean
  /** True when delivery didn't happen and the message was logged instead. */
  stubbed: boolean
  /** How delivery was (or wasn't) attempted — drives the log signal. */
  mode: EmailDeliveryMode
  error?: string
}

/**
 * - `live`: both key and from-address present → send via Resend.
 * - `stub`: neither present → expected in local dev, log a benign stub.
 * - `misconfigured`: exactly one present → likely a half-finished prod setup;
 *   nothing is sent, so this must be surfaced loudly rather than silently stubbed.
 */
export type EmailDeliveryMode = 'live' | 'stub' | 'misconfigured'

export function emailDeliveryMode(apiKey: string, from: string): EmailDeliveryMode {
  const hasKey = Boolean(apiKey?.trim())
  const hasFrom = Boolean(from?.trim())
  if (hasKey && hasFrom) return 'live'
  if (!hasKey && !hasFrom) return 'stub'
  return 'misconfigured'
}

/**
 * Resolve the Resend API key and from-address. Prefers the admin-only `settings`
 * rows (`resend.api_key`, `email.from_address`) and falls back to env vars so a
 * deployment can inject them either way. Secrets never live in code (CLAUDE.md).
 */
async function getEmailConfig() {
  const apiKey = (await getSetting('resend.api_key')) || process.env.RESEND_API_KEY || ''
  const from = (await getSetting('email.from_address')) || process.env.EMAIL_FROM || ''
  return { apiKey, from }
}

/** Whether real email delivery is configured (key + from-address both present). */
export async function isEmailConfigured(): Promise<boolean> {
  const { apiKey, from } = await getEmailConfig()
  return Boolean(apiKey && from)
}

/**
 * Send an email via Resend using the admin-configured key + from-address.
 *
 * When no key/from is configured (e.g. local dev), this is a **log stub**: the
 * subject and recipients are printed to the server console and `stubbed: true`
 * is returned, so the app runs end-to-end without an email provider. Real
 * delivery lands the moment an admin fills in the Resend settings (PRD §10).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { apiKey, from: configuredFrom } = await getEmailConfig()
  const from = input.from || configuredFrom
  const recipients = Array.isArray(input.to) ? input.to : [input.to]

  const mode = emailDeliveryMode(apiKey, from)
  if (mode !== 'live') {
    if (mode === 'misconfigured') {
      const missing = apiKey?.trim()
        ? 'email.from_address (or EMAIL_FROM) is missing'
        : 'resend.api_key (or RESEND_API_KEY) is missing'
      console.warn(
        `\n⚠️  [email misconfigured] ${missing} — message NOT sent.`
        + `\n   to: ${recipients.join(', ')}\n   subject: ${input.subject}\n`,
      )
    }
    else {
      console.info(
        `\n📧 [dev email stub] (no Resend key configured)\n   to: ${recipients.join(', ')}\n   subject: ${input.subject}\n`,
      )
    }
    return { ok: true, stubbed: true, mode }
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to: recipients,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    })
    if (error) {
      console.error('Resend send failed:', error)
      return { ok: false, stubbed: false, mode, error: error.message }
    }
    return { ok: true, stubbed: false, mode }
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('Resend send threw:', message)
    return { ok: false, stubbed: false, mode, error: message }
  }
}
