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
  /** True when no Resend key is configured and the message was logged instead. */
  stubbed: boolean
  error?: string
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

  if (!apiKey || !from) {
    console.info(
      `\n📧 [dev email stub] (no Resend key configured)\n   to: ${recipients.join(', ')}\n   subject: ${input.subject}\n`,
    )
    return { ok: true, stubbed: true }
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
      return { ok: false, stubbed: false, error: error.message }
    }
    return { ok: true, stubbed: false }
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('Resend send threw:', message)
    return { ok: false, stubbed: false, error: message }
  }
}
