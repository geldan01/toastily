import { desc, eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'

/** Recent notification send history (officer/admin). PRD §10. */
export default defineEventHandler(async (event) => {
  await requireMinRole(event, 'officer')
  const rows = await useDrizzle()
    .select({
      id: schema.emailSendLog.id,
      templateKey: schema.emailSendLog.templateKey,
      trigger: schema.emailSendLog.trigger,
      status: schema.emailSendLog.status,
      recipientCount: schema.emailSendLog.recipientCount,
      error: schema.emailSendLog.error,
      sentAt: schema.emailSendLog.sentAt,
      triggeredByName: schema.users.name,
    })
    .from(schema.emailSendLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.emailSendLog.triggeredBy))
    .orderBy(desc(schema.emailSendLog.sentAt))
    .limit(50)
  return { log: rows }
})
