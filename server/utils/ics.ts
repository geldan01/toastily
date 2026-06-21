/**
 * Minimal iCalendar (RFC 5545) generation for meeting calendar export (issue #59).
 *
 * Times are emitted as **floating local time** (no `Z`, no `TZID`): a club meeting
 * is a local event, and there is no club-timezone setting yet, so a floating time
 * is interpreted by each viewer's calendar in their own local zone — the pragmatic
 * correct-enough choice. DTSTAMP is the one UTC timestamp (generation time).
 *
 * These helpers are pure (no DB / no Nitro) so they're unit-testable in isolation.
 */

export interface IcsEvent {
  /** Stable, globally-unique UID (e.g. `meeting-<id>@toastily`). */
  uid: string
  /** Meeting date as `YYYY-MM-DD`. */
  date: string
  /** Start time as `HH:MM` (24h). */
  startTime: string
  /** Event length in minutes. */
  durationMinutes: number
  summary: string
  location?: string | null
  description?: string | null
  url?: string | null
}

/** Escape a value for an iCalendar TEXT field (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n')
}

/** Two-digit zero-pad. */
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Compute a meeting's floating-local start/end stamps (`YYYYMMDDTHHMMSS`).
 * Date arithmetic is done via a local `Date`; only local fields are read back, so
 * the host timezone cancels out and the result is genuinely floating.
 */
export function icsLocalRange(date: string, startTime: string, durationMinutes: number): { start: string, end: string } {
  const [y, m, d] = date.split('-').map(Number)
  const tm = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim())
  const hh = tm ? Number(tm[1]) : 0
  const mm = tm ? Number(tm[2]) : 0
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`
  const startDt = new Date(y!, (m! - 1), d!, hh, mm, 0, 0)
  const endDt = new Date(startDt.getTime() + Math.max(0, durationMinutes) * 60_000)
  return { start: fmt(startDt), end: fmt(endDt) }
}

/** UTC stamp (`YYYYMMDDTHHMMSSZ`) for DTSTAMP. */
function utcStamp(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`
}

/**
 * Fold a content line to ≤75 octets per RFC 5545 §3.1, continuation lines being
 * prefixed with a single space. Folding on character count is a safe
 * approximation for our largely-ASCII content.
 */
export function foldIcsLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  if (rest.length) parts.push(` ${rest}`)
  return parts.join('\r\n')
}

/**
 * Build a complete VCALENDAR document from a list of events. `now` is injected so
 * the output is deterministic for tests. Lines are CRLF-terminated per spec.
 */
export function buildIcsCalendar(events: IcsEvent[], opts: { calendarName?: string, now?: Date } = {}): string {
  const now = opts.now ?? new Date()
  const dtstamp = utcStamp(now)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Toastily//Meetings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  if (opts.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeIcsText(opts.calendarName)}`)
  }

  for (const ev of events) {
    const { start, end } = icsLocalRange(ev.date, ev.startTime, ev.durationMinutes)
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${ev.uid}`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`DTSTART:${start}`)
    lines.push(`DTEND:${end}`)
    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(ev.summary)}`))
    if (ev.location) lines.push(foldIcsLine(`LOCATION:${escapeIcsText(ev.location)}`))
    if (ev.description) lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(ev.description)}`))
    if (ev.url) lines.push(foldIcsLine(`URL:${escapeIcsText(ev.url)}`))
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
