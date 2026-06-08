<script setup lang="ts">
import { CalendarDays, CalendarOff } from '@lucide/vue'

interface MeetingRow { id: string, date: string, meetingNumber: number | null, status: 'scheduled' | 'cancelled', themeEn: string | null, themeFr: string | null, location: string | null }
interface HolidayRow { id: string, date: string, labelEn: string, labelFr: string }

const { locale, t } = useI18n()
const localePath = useLocalePath()

const { data } = await useFetch<{ meetings: MeetingRow[], holidays: HolidayRow[] }>('/api/meetings', { key: 'meetings-list' })

const todayIso = new Date().toISOString().slice(0, 10)
const upcoming = computed(() => (data.value?.meetings ?? []).filter(m => m.date >= todayIso).slice().reverse())
const past = computed(() => (data.value?.meetings ?? []).filter(m => m.date < todayIso))
const holidays = computed(() => (data.value?.holidays ?? []).filter(h => h.date >= todayIso))

function theme(m: MeetingRow) {
  return (locale.value === 'fr' ? m.themeFr : m.themeEn) || t('meetings.untitled')
}
function holidayLabel(h: HolidayRow) {
  return locale.value === 'fr' ? h.labelFr : h.labelEn
}
function fmt(iso: string) {
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(`${iso}T00:00:00`))
}

useHead(() => ({ title: t('meetings.title') }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight">
      {{ t('meetings.title') }}
    </h1>
    <p class="mt-2 text-muted-foreground">
      {{ t('meetings.subtitle') }}
    </p>

    <section class="mt-8">
      <h2 class="text-xl font-semibold">
        {{ t('meetings.upcoming') }}
      </h2>
      <p
        v-if="!upcoming.length"
        class="mt-2 text-sm text-muted-foreground"
      >
        {{ t('meetings.noneUpcoming') }}
      </p>
      <ul class="mt-3 space-y-2">
        <li
          v-for="m in upcoming"
          :key="m.id"
        >
          <NuxtLink
            :to="localePath(`/meeting/${m.date}`)"
            class="flex items-center gap-4 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted"
            :class="m.status === 'cancelled' ? 'opacity-60' : ''"
          >
            <CalendarDays class="size-5 shrink-0 text-secondary" />
            <div class="min-w-0">
              <div
                class="font-medium"
                :class="m.status === 'cancelled' ? 'line-through' : ''"
              >
                <span
                  v-if="m.meetingNumber != null"
                  class="mr-1.5 text-sm font-semibold text-secondary no-underline"
                >#{{ m.meetingNumber }}</span>{{ theme(m) }}
              </div>
              <div class="text-sm text-muted-foreground">
                {{ fmt(m.date) }}<template v-if="m.location"> · {{ m.location }}</template>
                <span
                  v-if="m.status === 'cancelled'"
                  class="font-medium text-destructive"
                > · {{ t('meetings.cancelled') }}</span>
              </div>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section
      v-if="holidays.length"
      class="mt-8"
    >
      <h2 class="text-xl font-semibold">
        {{ t('meetings.holidays') }}
      </h2>
      <ul class="mt-3 space-y-2">
        <li
          v-for="h in holidays"
          :key="h.id"
          class="flex items-center gap-4 rounded-lg border border-dashed border-border px-4 py-3 text-muted-foreground"
        >
          <CalendarOff class="size-5 shrink-0" />
          <div>
            <div class="font-medium text-foreground">
              {{ holidayLabel(h) }}
            </div>
            <div class="text-sm">
              {{ fmt(h.date) }}
            </div>
          </div>
        </li>
      </ul>
    </section>

    <section
      v-if="past.length"
      class="mt-8"
    >
      <h2 class="text-xl font-semibold">
        {{ t('meetings.past') }}
      </h2>
      <ul class="mt-3 space-y-2">
        <li
          v-for="m in past"
          :key="m.id"
        >
          <NuxtLink
            :to="localePath(`/meeting/${m.date}`)"
            class="flex items-center gap-4 rounded-lg border border-border px-4 py-3 text-muted-foreground transition-colors hover:bg-muted"
          >
            <CalendarDays class="size-5 shrink-0" />
            <div class="min-w-0">
              <div class="font-medium text-foreground">{{ theme(m) }}</div>
              <div class="text-sm">{{ fmt(m.date) }}</div>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
