import { eq } from 'drizzle-orm'
import { schema, useDrizzle } from '../../db/client'
import { sendNotification } from '../../utils/notifications'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function sameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * Scheduled-email dispatcher (PRD §10). Runs on the Nitro cron defined in
 * nuxt.config.ts (every 15 min). For each active schedule it fires the template
 * when today matches the schedule's weekday and the time has passed, guarding
 * against double-firing via `lastRunAt` (once per local day). Self-paced so the
 * exact cron cadence only bounds how soon after `timeOfDay` a send goes out.
 */
export default defineTask({
  meta: {
    name: 'notifications:dispatch',
    description: 'Send due scheduled email notifications (PRD §10).',
  },
  async run() {
    const db = useDrizzle()
    const now = new Date()
    const dow = now.getDay() // 0 = Sunday, local time
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`

    const schedules = await db.select().from(schema.emailSchedules).where(eq(schema.emailSchedules.active, true))

    const fired: string[] = []
    for (const s of schedules) {
      if (s.dayOfWeek !== dow) continue
      if (hhmm < s.timeOfDay) continue
      if (s.lastRunAt && sameLocalDate(new Date(s.lastRunAt), now)) continue

      try {
        const res = await sendNotification({ templateKey: s.templateKey, trigger: 'scheduled' })
        await db.update(schema.emailSchedules).set({ lastRunAt: now }).where(eq(schema.emailSchedules.id, s.id))
        fired.push(`${s.templateKey}:${res.status}(${res.recipientCount})`)
      }
      catch (e) {
        console.error(`notifications:dispatch failed for schedule ${s.id}:`, e)
      }
    }

    return { result: { fired } }
  },
})
