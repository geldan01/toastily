<script setup lang="ts">
import { CalendarDays, Users, X } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

interface MeetingDetail {
  meeting: { id: string, date: string, meetingNumber: number | null, status: 'scheduled' | 'cancelled', themeEn: string | null, themeFr: string | null, location: string | null, notesEn: string | null, notesFr: string | null, templateId: string | null } | null
  holiday: { labelEn: string, labelFr: string } | null
  canManageSignups?: boolean
}

const route = useRoute()
const date = computed(() => String(route.params.date))
const { locale, t } = useI18n()
const localePath = useLocalePath()

const { data } = await useFetch<MeetingDetail>(() => `/api/meetings/${date.value}`, {
  key: () => `meeting-${date.value}`,
})
const meeting = computed(() => data.value?.meeting ?? null)
const canManage = computed(() => data.value?.canManageSignups ?? false)

// Checked-in guests (PRD §9). Page is member-gated, so load right away.
interface Guest { id: string, name: string, email: string | null }
const { data: checkinData, execute: loadCheckins } = await useFetch<{ guests: Guest[] }>(() => `/api/meetings/${date.value}/checkins`, {
  key: () => `checkins-${date.value}`,
  immediate: false,
})
watch(meeting, (mt) => {
  if (mt && !checkinData.value) loadCheckins()
}, { immediate: true })
const checkedInGuests = computed(() => checkinData.value?.guests ?? [])

// QR target for guests to self-check-in: the admin-set qr.target_url if present,
// otherwise the dynamic /checkin resolver (PRD §9).
const reqUrl = useRequestURL()
const { setting } = useSettings()
const checkinUrl = computed(() => setting('qr.target_url') || `${reqUrl.origin}${localePath('/checkin')}`)

const busy = ref('')
const error = ref('')

async function removeCheckin(id: string) {
  busy.value = `checkin-${id}`
  error.value = ''
  try {
    await $fetch('/api/meetings/checkin', { method: 'DELETE', body: { id } })
    await loadCheckins()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = '' }
}

const theme = computed(() => meeting.value ? localized(meeting.value, 'theme', locale.value) : '')

const prettyDate = computed(() => {
  const d = new Date(`${date.value}T00:00:00`)
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(d)
})

useHead(() => ({ title: `${t('meetings.guestsTitle')}${theme.value ? ` — ${theme.value}` : ''}` }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <NuxtLink
      :to="localePath(`/meeting/${date}`)"
      class="text-sm text-muted-foreground hover:text-foreground"
    >
      ← {{ t('meetings.backToMeeting') }}
    </NuxtLink>

    <div class="mt-3 flex items-center gap-2 text-sm font-medium text-secondary">
      <CalendarDays class="size-4" />
      {{ prettyDate }}
    </div>

    <!-- No meeting on this date -->
    <template v-if="!meeting">
      <h1 class="mt-2 text-3xl font-bold tracking-tight">
        {{ t('meetings.noMeeting') }}
      </h1>
      <p class="mt-3 text-muted-foreground">
        {{ t('meetings.noMeetingBody') }}
      </p>
    </template>

    <template v-else>
      <h1 class="mt-2 flex items-center gap-2 text-3xl font-bold tracking-tight">
        <Users class="size-7" />
        {{ t('meetings.guestsTitle') }}
      </h1>
      <p
        v-if="theme"
        class="mt-2 text-muted-foreground"
      >
        {{ theme }}
      </p>

      <div
        v-if="error"
        class="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
      >
        {{ error }}
      </div>

      <div class="mt-6 rounded-lg border border-border p-4">
        <!-- Manager: QR to project so guests self-check-in -->
        <div
          v-if="canManage"
          class="flex flex-wrap items-center gap-4 border-b border-border pb-4"
        >
          <QrCode :value="checkinUrl" />
          <div class="min-w-48 flex-1 text-sm">
            <p class="font-medium">
              {{ t('meetings.projectQr') }}
            </p>
            <a
              :href="checkinUrl"
              target="_blank"
              class="mt-1 inline-block break-all text-secondary hover:underline"
            >{{ checkinUrl }}</a>
          </div>
        </div>

        <!-- Member-visible guest list -->
        <ul
          v-if="checkedInGuests.length"
          class="divide-y divide-border"
          :class="canManage ? 'mt-1' : ''"
        >
          <li
            v-for="g in checkedInGuests"
            :key="g.id"
            class="flex items-center justify-between gap-3 py-2.5"
          >
            <div>
              <span class="font-medium">{{ g.name }}</span>
              <span
                v-if="g.email"
                class="ml-2 text-sm text-muted-foreground"
              >{{ g.email }}</span>
            </div>
            <Button
              v-if="canManage"
              size="sm"
              variant="ghost"
              class="text-muted-foreground hover:text-destructive"
              :disabled="busy === `checkin-${g.id}`"
              @click="removeCheckin(g.id)"
            >
              <X class="size-4" />
            </Button>
          </li>
        </ul>
        <p
          v-else
          class="py-1 text-sm text-muted-foreground/70"
        >
          {{ t('meetings.noGuestsYet') }}
        </p>

        <!-- Add a guest on the spot -->
        <div class="mt-3 border-t border-border pt-3">
          <p class="mb-2 text-sm text-muted-foreground">
            {{ t('meetings.addGuestHint') }}
          </p>
          <GuestCheckInForm
            :meeting-id="meeting.id"
            @checked-in="loadCheckins()"
          />
        </div>
      </div>
    </template>
  </div>
</template>
