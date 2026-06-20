<script setup lang="ts">
import { CheckCircle2, ClipboardList, LogIn, MessageSquarePlus, NotebookPen, Printer, UserCheck, Users, Vote } from '@lucide/vue'

type AgendaSection = 'administrative' | 'speeches' | 'table_topics' | 'evaluations'
interface AgendaLine {
  kind: 'item' | 'speech' | 'evaluation'
  section: AgendaSection
  labelEn: string
  labelFr: string
  durationMinutes: number | null
  roleEn?: string | null
  roleFr?: string | null
  isEvaluatorRole?: boolean
  who?: string | null
  isGuest?: boolean
  slot?: number
  title?: string | null
}
interface Officer { nameEn: string, nameFr: string, who: string | null, isGuest: boolean }
interface AgendaData {
  meeting: { date: string, meetingNumber: number | null, status: 'scheduled' | 'cancelled', themeEn: string | null, themeFr: string | null, location: string | null, notesEn: string | null, notesFr: string | null } | null
  holiday: { labelEn: string, labelFr: string } | null
  lines: AgendaLine[]
  officers: Officer[]
}

const route = useRoute()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const { setting } = useSettings()
const { user } = useUserSession()

const date = computed(() => String(route.params.date))
const clubName = computed(() => setting('club.name', 'Toastily'))
const isMember = computed(() => hasMinRole(user.value?.status, 'member'))

// Toastmasters branding (club-configurable): the official logo plus the club's
// TI identity line (club number, area, division, district), shown on screen
// and on the printed agenda per TI brand guidelines.
const logoUrl = computed(() => setting('branding.logo_url', ''))
const logoFailed = ref(false)
const clubLine = computed(() => [
  setting('club.number') && t('agenda.clubNumber', { n: setting('club.number') }),
  setting('club.area') && t('agenda.area', { n: setting('club.area') }),
  setting('club.division') && t('agenda.division', { n: setting('club.division') }),
  setting('club.district') && t('agenda.district', { n: setting('club.district') }),
].filter(Boolean).join(' · '))

const { data } = await useFetch<AgendaData>(() => `/api/agenda/${date.value}`, {
  key: () => `agenda-${date.value}`,
})

const meeting = computed(() => data.value?.meeting ?? null)
const cancelled = computed(() => meeting.value?.status === 'cancelled')

// Minutes meta — member-gated endpoint (guests get 401), so only fetch for members.
type MinutesApprovalStatus = 'pending' | 'read' | 'amended'
interface MinutesRecord {
  unfinishedBusiness: string | null
  newBusiness: string | null
  upcomingEvents: string | null
  specialReminders: string | null
  generalEvaluatorMention: string | null
  submitterName: string | null
  submittedAt: string | null
  approvalStatus: MinutesApprovalStatus
  approverName: string | null
  approvedAt: string | null
  amendmentNotes: string | null
}
interface MinutesMeta { canManage: boolean, minutes: MinutesRecord | null }
const { data: minutesMeta } = await useFetch<MinutesMeta | null>(() => `/api/meetings/${date.value}/minutes`, {
  key: () => `minutes-meta-${date.value}`,
  immediate: isMember.value,
  default: () => null,
})

const minutesRecord = computed(() => minutesMeta.value?.minutes ?? null)

// Member self check-in (member-gated endpoint; guests get 401). The big button
// near the top lets a logged-in member mark themselves present for this meeting;
// it turns light once checked in, and tapping again clears it.
interface AttendanceMeta { meetingId: string | null, selfPresent: boolean }
const { data: attendanceMeta, refresh: refreshAttendance } = await useFetch<AttendanceMeta | null>(
  () => `/api/meetings/${date.value}/attendance`,
  { key: () => `attendance-self-${date.value}`, immediate: isMember.value, default: () => null },
)
const selfPresent = computed(() => attendanceMeta.value?.selfPresent ?? false)
const checkinBusy = ref(false)
async function toggleSelfCheckin() {
  const mid = attendanceMeta.value?.meetingId
  if (!mid || checkinBusy.value) return
  checkinBusy.value = true
  try {
    await $fetch('/api/meetings/attendance', selfPresent.value
      ? { method: 'DELETE', body: { meetingId: mid, userId: user.value?.id } }
      : { method: 'POST', body: { meetingId: mid } })
    await refreshAttendance()
  }
  finally { checkinBusy.value = false }
}
const MINUTES_SECTIONS = [
  { key: 'unfinishedBusiness', label: 'meetings.minutesUnfinishedBusiness' },
  { key: 'newBusiness', label: 'meetings.minutesNewBusiness' },
  { key: 'upcomingEvents', label: 'meetings.minutesUpcomingEvents' },
  { key: 'specialReminders', label: 'meetings.minutesSpecialReminders' },
  { key: 'generalEvaluatorMention', label: 'meetings.minutesGeneralEvaluatorMention' },
] as const
const minutesStatusWord = (s: MinutesApprovalStatus) => t(s === 'amended' ? 'meetings.minutesStatusAmended' : 'meetings.minutesStatusRead')
function fmtMinutesDate(iso: string) {
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(iso))
}
const theme = computed(() => meeting.value ? localized(meeting.value, 'theme', locale.value) : '')
const notes = computed(() => meeting.value ? localized(meeting.value, 'notes', locale.value) : '')
const lines = computed(() => data.value?.lines ?? [])
const officers = computed(() => data.value?.officers ?? [])
const totalMinutes = computed(() => lines.value.reduce((s, l) => s + (l.durationMinutes || 0), 0))

const officerRole = (o: Officer) => locale.value === 'fr' ? o.nameFr : o.nameEn

// The agenda table interleaves section headings with timed lines: a level-2
// heading on every section change (the administrative segment appears at both
// ends of the meeting), plus a one-time level-1 "Educative Session" heading
// before its first subsection. The clock runs continuously from the club's
// meeting.start_time setting; headings consume no time.
const SECTION_KEY: Record<AgendaSection, string> = {
  administrative: 'agenda.sectionAdministrative',
  speeches: 'agenda.sectionSpeeches',
  table_topics: 'agenda.sectionTableTopics',
  evaluations: 'agenda.sectionEvaluations',
}
type Row
  = | { type: 'header', level: 1 | 2, label: string }
    | { type: 'line', line: AgendaLine, clock: string }

const startTime = computed(() => setting('meeting.start_time', '18:00'))
function parseStartMinutes(hhmm: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : 18 * 60
}
const formatClock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  let minutes = parseStartMinutes(startTime.value)
  let prevSection: AgendaSection | null = null
  let educativeHeaderDone = false
  for (const l of lines.value) {
    if (l.section !== prevSection) {
      if (l.section !== 'administrative' && !educativeHeaderDone) {
        out.push({ type: 'header', level: 1, label: t('agenda.sectionEducative') })
        educativeHeaderDone = true
      }
      out.push({ type: 'header', level: 2, label: t(SECTION_KEY[l.section]) })
      prevSection = l.section
    }
    out.push({ type: 'line', line: l, clock: formatClock(minutes) })
    minutes += l.durationMinutes || 0
  }
  return out
})

function lineLabel(l: AgendaLine) {
  const base = locale.value === 'fr' ? l.labelFr : l.labelEn
  if (l.kind === 'speech' || l.kind === 'evaluation') return `${base} ${l.slot}${l.title ? ` — ${l.title}` : ''}`
  return base
}
function lineRole(l: AgendaLine) {
  if (l.kind === 'speech') return t('meetings.speaker')
  if (l.kind === 'evaluation') return t('meetings.evaluator')
  return (locale.value === 'fr' ? l.roleFr : l.roleEn) || ''
}
// Speakers and evaluators are highlighted in the TI brand gray: speech lines,
// evaluation lines, and items bound to a counts-as-evaluator role (Grammarian).
const highlighted = (l: AgendaLine) => l.kind !== 'item' || !!l.isEvaluatorRole

function printPage() {
  window.print()
}
function prettyDate(iso: string) {
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(`${iso}T00:00:00`))
}

useHead(() => ({ title: theme.value || `${t('agenda.title')} — ${prettyDate(date.value)}` }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10">
    <NuxtLink
      :to="localePath('/meetings')"
      class="text-sm text-muted-foreground hover:text-foreground print:hidden"
    >
      ← {{ t('meetings.title') }}
    </NuxtLink>

    <!-- No meeting on this date -->
    <template v-if="!meeting">
      <h1 class="mt-4 text-3xl font-bold tracking-tight">
        {{ data?.holiday ? (locale === 'fr' ? data.holiday.labelFr : data.holiday.labelEn) : t('meetings.noMeeting') }}
      </h1>
      <p
        v-if="!data?.holiday"
        class="mt-3 text-muted-foreground"
      >
        {{ t('meetings.noMeetingBody') }}
      </p>
    </template>

    <template v-else>
      <div
        v-if="cancelled"
        class="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive"
      >
        {{ t('meetings.cancelledBanner') }}
      </div>

      <article class="mt-6">
        <header>
          <!-- TI brand row: official logo top-left, club identity top-right -->
          <div class="flex items-center justify-between gap-4">
            <img
              v-if="logoUrl && !logoFailed"
              :src="logoUrl"
              alt="Toastmasters International"
              class="h-28 w-auto print:h-24"
              @error="logoFailed = true"
            >
            <div
              v-else
              aria-hidden="true"
            />
            <div class="text-right">
              <div class="font-bold text-primary">
                {{ clubName }}
              </div>
              <div
                v-if="clubLine"
                class="text-xs text-muted-foreground"
              >
                {{ clubLine }}
              </div>
            </div>
          </div>

          <h1
            class="mt-4 text-center text-2xl font-bold"
            :class="cancelled ? 'text-muted-foreground line-through' : ''"
          >
            {{ theme || t('agenda.title') }}
          </h1>
          <p class="mt-1 text-center text-sm text-muted-foreground">
            <template v-if="meeting.meetingNumber != null">
              {{ t('meetings.meetingNo', { n: meeting.meetingNumber }) }} ·
            </template>{{ prettyDate(meeting.date) }}<template v-if="meeting.location">
              · {{ meeting.location }}
            </template>
          </p>
        </header>

        <!-- Member self check-in: prominent near the top, turns light when in -->
        <div
          v-if="isMember && !cancelled"
          class="mt-5 print:hidden"
        >
          <button
            type="button"
            :disabled="checkinBusy || !attendanceMeta?.meetingId"
            class="flex w-full items-center justify-center gap-2 rounded-xl border px-6 py-4 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            :class="selfPresent
              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300'
              : 'border-transparent bg-blue-600 text-white shadow-sm hover:bg-blue-700'"
            @click="toggleSelfCheckin"
          >
            <component
              :is="selfPresent ? CheckCircle2 : LogIn"
              class="size-5"
            />
            {{ selfPresent ? t('meetings.checkedIn') : t('meetings.checkInButton') }}
          </button>
        </div>

        <!-- Meeting officers (introduced by the chair) — prints with the agenda -->
        <section
          v-if="!cancelled && officers.length"
          class="mt-5 rounded-lg border border-border px-4 py-3 print:rounded-none print:border-x-0 print:px-0"
        >
          <h2 class="text-xs font-bold uppercase tracking-wide text-secondary">
            {{ t('agenda.officers') }}
          </h2>
          <ul class="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <li
              v-for="o in officers"
              :key="o.nameEn"
              class="flex items-baseline justify-between gap-3"
            >
              <span class="text-muted-foreground">{{ officerRole(o) }}</span>
              <span
                v-if="o.who"
                class="text-right font-semibold"
              >{{ o.who }}<span
                v-if="o.isGuest"
                class="font-normal text-xs text-muted-foreground"
              > ({{ t('meetings.guest') }})</span></span>
              <span
                v-else
                class="text-muted-foreground/50"
              >—</span>
            </li>
          </ul>
        </section>

        <p
          v-if="notes"
          class="mt-4 whitespace-pre-line text-muted-foreground print:hidden"
        >
          {{ notes }}
        </p>

        <table
          v-if="!cancelled"
          class="mt-6 w-full border-collapse text-sm"
        >
          <thead>
            <tr class="border-b-2 border-foreground/70 text-left">
              <th class="w-16 py-2 pr-2 font-semibold">
                {{ t('agenda.time') }}
              </th>
              <th class="w-12 py-2 pr-2 font-semibold">
                {{ t('agenda.min') }}
              </th>
              <th class="py-2 pr-2 font-semibold">
                {{ t('agenda.item') }}
              </th>
              <th class="py-2 font-semibold">
                {{ t('agenda.who') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <template
              v-for="(r, i) in rows"
              :key="i"
            >
              <tr v-if="r.type === 'header' && r.level === 1">
                <td
                  colspan="4"
                  class="border-b-2 border-foreground/70 pb-1 pt-5 text-base font-bold uppercase tracking-wide"
                >
                  {{ r.label }}
                </td>
              </tr>
              <tr v-else-if="r.type === 'header'">
                <td
                  colspan="4"
                  class="border-b border-border bg-muted/40 px-1 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-secondary print:bg-transparent"
                >
                  {{ r.label }}
                </td>
              </tr>
              <tr
                v-else
                class="border-b border-border align-top"
                :class="{ 'bg-tm-gray/30': highlighted(r.line) }"
              >
                <td class="py-2 pr-2 tabular-nums text-muted-foreground">
                  {{ r.clock }}
                </td>
                <td class="py-2 pr-2 tabular-nums text-muted-foreground">
                  {{ r.line.durationMinutes ?? '' }}
                </td>
                <td class="py-2 pr-2">
                  <div class="font-medium">
                    {{ lineLabel(r.line) }}
                  </div>
                  <div
                    v-if="lineRole(r.line)"
                    class="text-xs text-muted-foreground"
                  >
                    {{ lineRole(r.line) }}
                  </div>
                </td>
                <td class="py-2">
                  <span
                    v-if="r.line.who"
                    class="font-bold"
                  >{{ r.line.who }}<span
                    v-if="r.line.isGuest"
                    class="font-normal text-xs text-muted-foreground"
                  > ({{ t('meetings.guest') }})</span></span>
                  <span
                    v-else
                    class="text-muted-foreground/50"
                  >—</span>
                </td>
              </tr>
            </template>
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-foreground/70">
              <td
                class="py-2 pr-2 font-semibold tabular-nums"
                colspan="2"
              >
                {{ totalMinutes }}
              </td>
              <td
                class="py-2 font-semibold"
                colspan="2"
              >
                {{ t('agenda.totalDuration') }}
              </td>
            </tr>
          </tfoot>
        </table>
      </article>

      <!-- Submitted minutes (members only) — readable on screen and on print -->
      <section
        v-if="isMember && minutesRecord"
        class="mt-8 border-t border-border pt-6"
      >
        <h2 class="flex items-center gap-2 text-lg font-semibold">
          <NotebookPen class="size-5 print:hidden" />
          {{ t('meetings.minutesTitle') }}
        </h2>
        <dl class="mt-4 space-y-4">
          <div
            v-for="s in MINUTES_SECTIONS"
            :key="s.key"
          >
            <dt class="text-sm font-semibold text-secondary">
              {{ t(s.label) }}
            </dt>
            <dd class="mt-1 whitespace-pre-line text-sm">
              {{ minutesRecord[s.key] || '—' }}
            </dd>
          </div>
        </dl>
        <footer class="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          <p v-if="minutesRecord.submittedAt">
            {{ t('meetings.minutesSubmittedBy', { name: minutesRecord.submitterName ?? '—', date: fmtMinutesDate(minutesRecord.submittedAt) }) }}
          </p>
          <p
            v-if="minutesRecord.approvalStatus !== 'pending' && minutesRecord.approvedAt"
            class="mt-1"
          >
            {{ t('meetings.minutesApprovedBy', { status: minutesStatusWord(minutesRecord.approvalStatus), name: minutesRecord.approverName ?? '—', date: fmtMinutesDate(minutesRecord.approvedAt) }) }}
          </p>
          <p
            v-if="minutesRecord.amendmentNotes"
            class="mt-2 whitespace-pre-line"
          >
            <span class="font-medium">{{ t('meetings.minutesAmendmentNotes') }}:</span>
            {{ minutesRecord.amendmentNotes }}
          </p>
        </footer>
      </section>

      <!-- Actions: signup & guests for members, voting for everyone in the room -->
      <div
        v-if="!cancelled"
        class="mt-8 flex flex-wrap gap-3 border-t border-border pt-6 print:hidden"
      >
        <Button
          v-if="isMember"
          as-child
          variant="secondary"
        >
          <NuxtLink :to="localePath(`/meeting/${date}/signup`)">
            <ClipboardList class="size-4" />
            {{ t('meetings.signupTitle') }}
          </NuxtLink>
        </Button>
        <Button
          as-child
          class="bg-blue-600 text-white hover:bg-blue-700"
        >
          <NuxtLink :to="localePath(`/meeting/${date}/vote`)">
            <Vote class="size-4" />
            {{ t('voting.title') }}
          </NuxtLink>
        </Button>
        <Button
          as-child
          variant="secondary"
        >
          <NuxtLink :to="localePath(`/meeting/${date}/evaluations`)">
            <MessageSquarePlus class="size-4" />
            {{ t('meetings.evalTitle') }}
          </NuxtLink>
        </Button>
        <Button
          v-if="isMember"
          as-child
          variant="secondary"
        >
          <NuxtLink :to="localePath(`/meeting/${date}/guests`)">
            <Users class="size-4" />
            {{ t('meetings.guestsTitle') }}
          </NuxtLink>
        </Button>
        <Button
          v-if="isMember"
          as-child
          variant="secondary"
        >
          <NuxtLink :to="localePath(`/meeting/${date}/attendance`)">
            <UserCheck class="size-4" />
            {{ t('meetings.attendanceTitle') }}
          </NuxtLink>
        </Button>
        <Button
          v-if="minutesMeta?.canManage"
          as-child
          variant="secondary"
        >
          <NuxtLink :to="localePath(`/meeting/${date}/minutes`)">
            <NotebookPen class="size-4" />
            {{ t('meetings.secretaryTitle') }}
          </NuxtLink>
        </Button>
        <Button
          variant="outline"
          @click="printPage"
        >
          <Printer class="size-4" />
          {{ t('agenda.print') }}
        </Button>
      </div>
    </template>
  </div>
</template>
