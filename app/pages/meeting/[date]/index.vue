<script setup lang="ts">
import { ClipboardList, Printer, Users, Vote } from '@lucide/vue'

interface AgendaLine {
  kind: 'item' | 'speech' | 'evaluation'
  labelEn: string
  labelFr: string
  durationMinutes: number | null
  roleEn?: string | null
  roleFr?: string | null
  who?: string | null
  isGuest?: boolean
  slot?: number
  title?: string | null
}
interface AgendaData {
  meeting: { date: string, meetingNumber: number | null, status: 'scheduled' | 'cancelled', themeEn: string | null, themeFr: string | null, location: string | null, notesEn: string | null, notesFr: string | null } | null
  holiday: { labelEn: string, labelFr: string } | null
  lines: AgendaLine[]
}

const route = useRoute()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const { setting } = useSettings()
const { user } = useUserSession()

const date = computed(() => String(route.params.date))
const clubName = computed(() => setting('club.name', 'Toastily'))
const isMember = computed(() => hasMinRole(user.value?.status, 'member'))

const { data } = await useFetch<AgendaData>(() => `/api/agenda/${date.value}`, {
  key: () => `agenda-${date.value}`,
})

const meeting = computed(() => data.value?.meeting ?? null)
const cancelled = computed(() => meeting.value?.status === 'cancelled')
const theme = computed(() => meeting.value ? localized(meeting.value, 'theme', locale.value) : '')
const notes = computed(() => meeting.value ? localized(meeting.value, 'notes', locale.value) : '')
const lines = computed(() => data.value?.lines ?? [])
const totalMinutes = computed(() => lines.value.reduce((s, l) => s + (l.durationMinutes || 0), 0))

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

      <!-- Actions: signup & guests for members, voting for everyone in the room -->
      <div
        v-if="!cancelled"
        class="mt-4 flex flex-wrap gap-3 print:hidden"
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
          variant="outline"
          @click="printPage"
        >
          <Printer class="size-4" />
          {{ t('agenda.print') }}
        </Button>
      </div>

      <article class="mt-6">
        <header class="text-center">
          <div class="text-sm font-semibold uppercase tracking-wide text-secondary">
            {{ clubName }}
          </div>
          <h1
            class="mt-1 text-2xl font-bold"
            :class="cancelled ? 'text-muted-foreground line-through' : ''"
          >
            {{ theme || t('agenda.title') }}
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            <template v-if="meeting.meetingNumber != null">
              {{ t('meetings.meetingNo', { n: meeting.meetingNumber }) }} ·
            </template>{{ prettyDate(meeting.date) }}<template v-if="meeting.location">
              · {{ meeting.location }}
            </template>
          </p>
        </header>

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
              <th class="w-14 py-2 pr-2 font-semibold">
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
            <tr
              v-for="(l, i) in lines"
              :key="i"
              class="border-b border-border align-top"
              :class="{ 'bg-muted/40': l.kind !== 'item' }"
            >
              <td class="py-2 pr-2 tabular-nums text-muted-foreground">
                {{ l.durationMinutes ?? '' }}
              </td>
              <td class="py-2 pr-2">
                <div class="font-medium">
                  {{ lineLabel(l) }}
                </div>
                <div
                  v-if="lineRole(l)"
                  class="text-xs text-muted-foreground"
                >
                  {{ lineRole(l) }}
                </div>
              </td>
              <td class="py-2">
                <span v-if="l.who">{{ l.who }}<span
                  v-if="l.isGuest"
                  class="text-xs text-muted-foreground"
                > ({{ t('meetings.guest') }})</span></span>
                <span
                  v-else
                  class="text-muted-foreground/50"
                >—</span>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-foreground/70">
              <td class="py-2 pr-2 font-semibold tabular-nums">
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
    </template>
  </div>
</template>
