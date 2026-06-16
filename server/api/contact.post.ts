/**
 * Public contact form (issue #16, PRD §5.2). Anyone may submit; the message is
 * emailed to the club contact address (`club.email` setting) via the shared
 * Resend service — which gracefully logs a dev stub when email isn't configured
 * locally. A hidden honeypot field (`company`) filters out naive bots.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))

  // Honeypot: real users never fill this hidden field. Pretend success so bots
  // get no signal, but send nothing.
  if (String(body?.company ?? '').trim()) {
    return { ok: true }
  }

  const name = String(body?.name ?? '').trim()
  const email = String(body?.email ?? '').trim()
  const message = String(body?.message ?? '').trim()

  if (!name || !email || !message) {
    throw createError({ statusCode: 400, statusMessage: 'Name, email and message are required.' })
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw createError({ statusCode: 400, statusMessage: 'A valid email address is required.' })
  }
  if (message.length > 5000) {
    throw createError({ statusCode: 400, statusMessage: 'Message is too long.' })
  }

  const to = (await getSetting('club.email')) || ''
  if (!to) {
    throw createError({ statusCode: 503, statusMessage: 'Contact address is not configured.' })
  }

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const result = await sendEmail({
    to,
    subject: `Contact form · ${name}`,
    html: `
      <p><strong>Name / Nom:</strong> ${esc(name)}</p>
      <p><strong>Email / Courriel:</strong> ${esc(email)}</p>
      <hr>
      <p style="white-space:pre-wrap">${esc(message)}</p>`,
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
  })

  if (!result.ok) {
    throw createError({ statusCode: 502, statusMessage: 'Message could not be sent. Please try again later.' })
  }

  return { ok: true }
})
