/**
 * Club-configurable speech timing (PRD §6.3), read from settings with safe
 * fallbacks (the standard Toastmasters 5–7 window + a 2-minute agenda buffer):
 *  - `default_min` / `default_max` seed a new speech's timing window;
 *  - `buffer` is added to a speech's max when allotting agenda time, covering
 *    transitions and applause ("an average of 2 minutes over the maximum").
 */
export interface SpeechTiming { defaultMin: number, defaultMax: number, buffer: number }

function posInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

export async function speechTiming(): Promise<SpeechTiming> {
  const [min, max, buffer] = await Promise.all([
    getSetting('speech.default_min_minutes'),
    getSetting('speech.default_max_minutes'),
    getSetting('speech.agenda_buffer_minutes'),
  ])
  return {
    defaultMin: posInt(min, 5),
    defaultMax: posInt(max, 7),
    buffer: posInt(buffer, 2),
  }
}

/** Agenda minutes allotted to a speech: its max (or the default) + the buffer. */
export function agendaSpeechMinutes(maxMinutes: number | null | undefined, timing: SpeechTiming): number {
  const max = maxMinutes == null ? timing.defaultMax : maxMinutes
  return max + timing.buffer
}
