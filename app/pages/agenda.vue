<script setup lang="ts">
import { Printer } from '@lucide/vue'

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
  meeting: { date: string, meetingNumber: number | null, themeEn: string | null, themeFr: string | null, location: string | null } | null
  lines: AgendaLine[]
}

const route = useRoute()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const { setting } = useSettings()

const date = computed(() => String(route.query.date ?? ''))
const clubName = computed(() => setting('club.name', 'Toastily'))

const { data } = await useFetch<AgendaData>(() => `/api/agenda/${date.value}`, {
  key: () => `agenda-${date.value}`,
})

const meeting = computed(() => data.value?.meeting ?? null)
const theme = computed(() => meeting.value ? localized(meeting.value, 'theme', locale.value) : '')
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

useHead(() => ({ title: `${t('agenda.title')}${theme.value ? ` — ${theme.value}` : ''}` }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10">
    <div class="flex items-center justify-between gap-4 print:hidden">
      <NuxtLink
        v-if="date"
        :to="localePath(`/meeting/${date}`)"
        class="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {{ t('agenda.backToMeeting') }}
      </NuxtLink>
      <Button
        v-if="meeting"
        variant="secondary"
        @click="printPage"
      >
        <Printer class="size-4" />
        {{ t('agenda.print') }}
      </Button>
    </div>

    <p
      v-if="!meeting"
      class="mt-8 rounded-md border border-border bg-muted/40 px-4 py-3 text-muted-foreground"
    >
      {{ t('agenda.noMeeting') }}
    </p>

    <article
      v-else
      class="mt-6"
    >
      <header class="text-center">
        <div class="text-sm font-semibold uppercase tracking-wide text-secondary">
          {{ clubName }}
        </div>
        <h1 class="mt-1 text-2xl font-bold">
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

      <table class="mt-6 w-full border-collapse text-sm">
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
  </div>
</template>
