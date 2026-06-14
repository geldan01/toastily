/**
 * Send a one-off test email to the requesting admin's own address (admin-only).
 *
 * This is a delivery diagnostic: it returns Resend's actual result — including
 * the `mode` (live / stub / misconfigured) and any provider error message — so
 * an admin can tell whether email is genuinely going out without having to read
 * server logs. The common production failure (issue #28) is a from-address on
 * an unverified Resend domain: the send is attempted but Resend rejects it.
 */
export default defineEventHandler(async (event) => {
  const user = await requireMinRole(event, 'admin')

  const result = await sendEmail({
    to: user.email,
    subject: 'Toastily test email · Courriel de test',
    html: `
      <p>This is a test email from Toastily. If you received it, email delivery is configured correctly.</p>
      <hr>
      <p>Ceci est un courriel de test de Toastily. Si vous l'avez reçu, l'envoi de courriels est correctement configuré.</p>`,
  })

  return {
    ok: result.ok,
    mode: result.mode,
    stubbed: result.stubbed,
    sentTo: user.email,
    error: result.error ?? null,
  }
})
