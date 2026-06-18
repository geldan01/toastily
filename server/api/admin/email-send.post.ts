/**
 * Manual "Send now" (PRD §10): immediately send a notification template to all
 * members (officer/admin). Records the send in the log via sendNotification.
 */
export default defineEventHandler(async (event) => {
  const user = await requireCommunicationManager(event)
  const body = await readBody(event)
  const templateKey = String(body?.templateKey ?? '').trim()
  if (!templateKey) throw createError({ statusCode: 400, statusMessage: 'A template key is required.' })

  const result = await sendNotification({ templateKey, trigger: 'manual', triggeredBy: user.id })
  return result
})
