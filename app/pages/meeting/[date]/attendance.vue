<script setup lang="ts">
import { CalendarDays, Check, UserCheck, Users } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

interface PresentMember { id: string, userId: string, name: string, source: 'self' | 'secretary' }
interface AttendanceData {
  meetingId: string | null
  present: PresentMember[]
  count: { members: number, guests: number, total: number }
  selfPresent: boolean
  canManage: boolean
}

const route = useRoute()
const date = computed(() => String(route.params.date))
const { locale, t } = useI18n()
const localePath = useLocalePath()
const { user } = useUserSession()

// Meeting header (theme/date). Reuse the public meeting detail endpoint.
interface MeetingDetail {
  meeting: { id: string, date: string, themeEn: string | null, themeFr: string | null } | null
}
const { data: meetingData } = await useFetch<MeetingDetail>(() => `/api/meetings/${date.value}`, {
  key: () => `meeting-${date.value}`,
})
const meeting = computed(() => meetingData.value?.meeting ?? null)
const theme = computed(() => meeting.value ? localized(meeting.value, 'theme', locale.value) : '')

const { data, refresh } = await useFetch<AttendanceData>(() => `/api/meetings/${date.value}/attendance`, {
  key: () => `attendance-${date.value}`,
})
const canManage = computed(() => data.value?.canManage ?? false)
const present = computed(() => data.value?.present ?? [])
const presentCount = computed(() => data.value?.count ?? { members: 0, guests: 0, total: 0 })
const selfPresent = computed(() => data.value?.selfPresent ?? false)
const presentIds = computed(() => new Set(present.value.map(p => p.userId)))

// Roster for the manager's pre-filled editor — only loaded for managers.
interface Member { id: string, name: string }
const { data: memberData, execute: loadMembers } = await useFetch<{ members: Member[] }>('/api/meetings/members', {
  key: 'meeting-members',
  immediate: false,
})
watch(canManage, (v) => {
  if (v && !memberData.value) loadMembers()
}, { immediate: true })
const roster = computed(() => memberData.value?.members ?? [])

const busy = ref('')
const error = ref('')

async function setPresent(userId: string, presentNow: boolean) {
  if (!meeting.value) return
  busy.value = userId
  error.value = ''
  try {
    if (presentNow) {
      await $fetch('/api/meetings/attendance', { method: 'POST', body: { meetingId: meeting.value.id, userId } })
    }
    else {
      await $fetch('/api/meetings/attendance', { method: 'DELETE', body: { meetingId: meeting.value.id, userId } })
    }
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = '' }
}

async function toggleSelf() {
  if (!meeting.value || !user.value) return
  busy.value = 'self'
  error.value = ''
  try {
    if (selfPresent.value) {
      await $fetch('/api/meetings/attendance', { method: 'DELETE', body: { meetingId: meeting.value.id, userId: user.value.id } })
    }
    else {
      await $fetch('/api/meetings/attendance', { method: 'POST', body: { meetingId: meeting.value.id } })
    }
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = '' }
}

const prettyDate = computed(() => {
  const d = new Date(`${date.value}T00:00:00`)
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(d)
})

useHead(() => ({ title: `${t('meetings.attendanceTitle')}${theme.value ? ` — ${theme.value}` : ''}` }))
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
        <UserCheck class="size-7" />
        {{ t('meetings.attendanceTitle') }}
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

      <!-- Present count (quorum aid) -->
      <div class="mt-6 grid grid-cols-3 gap-3">
        <Card>
          <CardHeader class="items-center gap-1 py-4 text-center">
            <CardTitle class="text-2xl tabular-nums">
              {{ presentCount.members }}
            </CardTitle>
            <CardDescription>{{ t('meetings.membersPresent') }}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader class="items-center gap-1 py-4 text-center">
            <CardTitle class="text-2xl tabular-nums">
              {{ presentCount.guests }}
            </CardTitle>
            <CardDescription>{{ t('meetings.guestsPresent') }}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader class="items-center gap-1 py-4 text-center">
            <CardTitle class="text-2xl tabular-nums text-secondary">
              {{ presentCount.total }}
            </CardTitle>
            <CardDescription>{{ t('meetings.totalPresent') }}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <!-- Self check-in -->
      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div class="flex items-center gap-2 text-sm">
          <Check
            v-if="selfPresent"
            class="size-5 text-secondary"
          />
          <span :class="selfPresent ? 'font-medium' : 'text-muted-foreground'">
            {{ selfPresent ? t('meetings.youArePresent') : t('meetings.markYourselfPresentHint') }}
          </span>
        </div>
        <Button
          :variant="selfPresent ? 'outline' : 'default'"
          :disabled="busy === 'self'"
          @click="toggleSelf"
        >
          {{ selfPresent ? t('meetings.imNotHere') : t('meetings.imPresent') }}
        </Button>
      </div>

      <!-- Manager: full roster with pre-filled present toggles -->
      <section
        v-if="canManage"
        class="mt-8"
      >
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Users class="size-5" /> {{ t('meetings.recordAttendance') }}
        </h2>
        <p class="mb-3 text-sm text-muted-foreground">
          {{ t('meetings.recordAttendanceHint') }}
        </p>
        <ul class="divide-y divide-border rounded-lg border border-border">
          <li
            v-for="m in roster"
            :key="m.id"
            class="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <span :class="presentIds.has(m.id) ? 'font-medium' : ''">{{ m.name }}</span>
            <Button
              :variant="presentIds.has(m.id) ? 'secondary' : 'outline'"
              size="sm"
              :disabled="busy === m.id"
              @click="setPresent(m.id, !presentIds.has(m.id))"
            >
              <Check
                v-if="presentIds.has(m.id)"
                class="size-4"
              />
              {{ presentIds.has(m.id) ? t('meetings.present') : t('meetings.markPresent') }}
            </Button>
          </li>
        </ul>
      </section>

      <!-- Members present (read-only list for non-managers) -->
      <section
        v-else
        class="mt-8"
      >
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Users class="size-5" /> {{ t('meetings.membersPresent') }}
        </h2>
        <ul
          v-if="present.length"
          class="divide-y divide-border rounded-lg border border-border"
        >
          <li
            v-for="p in present"
            :key="p.id"
            class="px-4 py-2.5"
          >
            {{ p.name }}
          </li>
        </ul>
        <p
          v-else
          class="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground"
        >
          {{ t('meetings.nonePresentYet') }}
        </p>
      </section>
    </template>
  </div>
</template>
