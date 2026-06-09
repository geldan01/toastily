<script setup lang="ts">
// Public guest check-in landing (PRD §9). The meeting QR points here; the page
// resolves the nearest upcoming meeting so a single static QR always lands guests
// on today's meeting with no per-meeting admin work. Works fully logged-out.
import { CalendarDays, MapPin } from '@lucide/vue'

type CurrentMeeting = { id: string, date: string, themeEn: string | null, themeFr: string | null, location: string | null }

const { locale, t } = useI18n()
const localePath = useLocalePath()

const { data } = await useFetch<{ meeting: CurrentMeeting | null }>('/api/checkin/current', { key: 'checkin-current' })
const meeting = computed(() => data.value?.meeting ?? null)
const theme = computed(() => meeting.value ? localized(meeting.value, 'theme', locale.value) : '')

const prettyDate = computed(() => {
  if (!meeting.value) return ''
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(`${meeting.value.date}T00:00:00`))
})

useHead(() => ({ title: t('meetings.checkInTitle') }))
</script>

<template>
  <div class="mx-auto max-w-xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight">
      {{ t('meetings.checkInTitle') }}
    </h1>

    <template v-if="meeting">
      <p class="mt-2 text-muted-foreground">
        {{ t('meetings.checkInIntro') }}
      </p>

      <div class="mt-6 rounded-lg border border-border p-5">
        <div class="flex items-center gap-2 text-sm font-medium text-secondary">
          <CalendarDays class="size-4" />
          {{ prettyDate }}
        </div>
        <h2 class="mt-1 text-xl font-semibold">
          {{ theme || t('meetings.untitled') }}
        </h2>
        <p
          v-if="meeting.location"
          class="mt-1 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <MapPin class="size-4" /> {{ meeting.location }}
        </p>

        <div class="mt-5">
          <GuestCheckInForm :meeting-id="meeting.id" />
        </div>
      </div>

      <NuxtLink
        :to="localePath(`/meeting/${meeting.date}`)"
        class="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        {{ t('meetings.viewMeeting') }} →
      </NuxtLink>
    </template>

    <p
      v-else
      class="mt-3 text-muted-foreground"
    >
      {{ t('meetings.noUpcomingMeeting') }}
    </p>
  </div>
</template>
