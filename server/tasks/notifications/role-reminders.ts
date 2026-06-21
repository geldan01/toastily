import { and, eq, gte, isNull, lte } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'
import { notifyRoleReminders } from '../../utils/notifications'
import { getSetting } from '../../utils/settings'

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Pre-meeting role reminders (issue #59, PRD §10). Runs daily; for every
 * scheduled meeting that has entered the reminder window (today ≤ date ≤
 * today + `meeting.reminder_days_before`) and hasn't been reminded yet, emails
 * each member holding a role or speech on it. `roleReminderSentAt` guards against
 * re-sending — set once the batch goes out, so repeated polling is a no-op.
 */
export default defineTask({
  meta: {
    name: 'notifications:role-reminders',
    description: 'Email members a reminder before a meeting where they hold a role (issue #59).',
  },
  async run() {
    const db = useDrizzle()

    const leadRaw = Number.parseInt((await getSetting('meeting.reminder_days_before')) ?? '', 10)
    const leadDays = Number.isFinite(leadRaw) && leadRaw >= 0 ? leadRaw : 1
    const today = isoDaysFromNow(0)
    const windowEnd = isoDaysFromNow(leadDays)

    const due = await db.select({ id: schema.meetings.id, date: schema.meetings.date })
      .from(schema.meetings)
      .where(and(
        eq(schema.meetings.status, 'scheduled'),
        gte(schema.meetings.date, today),
        lte(schema.meetings.date, windowEnd),
        isNull(schema.meetings.roleReminderSentAt),
      ))

    const fired: string[] = []
    for (const m of due) {
      try {
        const res = await notifyRoleReminders(m.id)
        // Mark sent so the meeting is reminded only once (even with no recipients,
        // so we don't re-scan it every run).
        await db.update(schema.meetings)
          .set({ roleReminderSentAt: new Date() })
          .where(eq(schema.meetings.id, m.id))
        fired.push(`${m.date}:${res.status}(${res.recipientCount})`)
      }
      catch (e) {
        console.error(`notifications:role-reminders failed for meeting ${m.id}:`, e)
      }
    }

    return { result: { fired } }
  },
})
