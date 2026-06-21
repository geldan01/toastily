import type { IcsEvent } from './ics'
import { getSetting } from './settings'

type Locale = 'en' | 'fr'

export interface CalendarMeetingRow {
  id: string
  date: string
  meetingNumber: number | null
  themeEn: string | null
  themeFr: string | null
  location: string | null
}

export interface MeetingCalendarConfig {
  clubName: string
  startTime: string
  durationMinutes: number
  defaultLocation: string
  siteUrl: string
}

function siteUrl(): string {
  return process.env.SITE_URL || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

/** Resolve a requested `?lang=` query into a supported locale. */
export function resolveIcsLocale(raw: unknown, fallback: Locale = 'en'): Locale {
  return raw === 'fr' || raw === 'en' ? raw : fallback
}

/** Read the club/meeting settings the calendar export needs, with sane defaults. */
export async function loadMeetingCalendarConfig(): Promise<MeetingCalendarConfig> {
  const [clubName, startTime, durationRaw, address] = await Promise.all([
    getSetting('club.name'),
    getSetting('meeting.start_time'),
    getSetting('meeting.duration_minutes'),
    getSetting('meeting.address'),
  ])
  const durationMinutes = Number.parseInt(durationRaw ?? '', 10)
  return {
    clubName: clubName?.trim() || 'Toastmasters',
    startTime: /^\d{1,2}:\d{2}$/.test(startTime?.trim() ?? '') ? startTime!.trim() : '18:00',
    durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 120,
    defaultLocation: address?.trim() || '',
    siteUrl: siteUrl(),
  }
}

/** Map meeting rows to iCalendar events for the given locale. */
export function buildMeetingEvents(
  meetings: CalendarMeetingRow[],
  cfg: MeetingCalendarConfig,
  locale: Locale,
): IcsEvent[] {
  return meetings.map((m) => {
    const theme = (locale === 'fr' ? m.themeFr : m.themeEn)?.trim() || null
    const number = m.meetingNumber != null ? ` #${m.meetingNumber}` : ''
    const summary = theme ? `${cfg.clubName}${number} — ${theme}` : `${cfg.clubName}${number}`
    const url = `${cfg.siteUrl}/meeting/${m.date}`
    const seeAgenda = locale === 'fr' ? `Ordre du jour : ${url}` : `Agenda: ${url}`
    return {
      uid: `meeting-${m.id}@toastily`,
      date: m.date,
      startTime: cfg.startTime,
      durationMinutes: cfg.durationMinutes,
      summary,
      location: m.location?.trim() || cfg.defaultLocation || null,
      description: seeAgenda,
      url,
    }
  })
}
