<script setup lang="ts">
// Dedicated in-meeting voting page (PRD §8), reached from the blue "Vote" button
// on the meeting page. Shows the four ballots; voting is only possible once the
// Sergeant-at-Arms opens a ballot and until they close it. Managers get a link to
// the large-format results page.
import { BarChart3, CalendarDays } from '@lucide/vue'

interface MeetingDetail {
  meeting: { id: string, date: string, status: 'scheduled' | 'cancelled', themeEn: string | null, themeFr: string | null } | null
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
const theme = computed(() => meeting.value ? localized(meeting.value, 'theme', locale.value) : '')

// Member roster for the manager's table-topics assign dropdown.
interface Member { id: string, name: string }
const { data: memberData, execute: loadMembers } = await useFetch<{ members: Member[] }>('/api/meetings/members', {
  key: 'meeting-members',
  immediate: false,
})
watch(canManage, (v) => {
  if (v && !memberData.value) loadMembers()
}, { immediate: true })
const members = computed(() => memberData.value?.members ?? [])

const prettyDate = computed(() => {
  const d = new Date(`${date.value}T00:00:00`)
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(d)
})

useHead(() => ({ title: `${t('voting.title')} — ${theme.value || prettyDate.value}` }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <NuxtLink
      :to="localePath(`/meeting/${date}`)"
      class="text-sm text-muted-foreground hover:text-foreground"
    >
      ← {{ t('voting.backToMeeting') }}
    </NuxtLink>

    <div class="mt-3 flex items-center gap-2 text-sm font-medium text-secondary">
      <CalendarDays class="size-4" />
      {{ prettyDate }}
    </div>

    <template v-if="meeting">
      <div class="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">
            {{ t('voting.title') }}
          </h1>
          <p
            v-if="theme"
            class="mt-1 text-muted-foreground"
          >
            {{ theme }}
          </p>
        </div>
        <Button
          v-if="canManage"
          as-child
          variant="secondary"
        >
          <NuxtLink :to="localePath(`/meeting/${date}/results`)">
            <BarChart3 class="size-4" />
            {{ t('voting.resultsButton') }}
          </NuxtLink>
        </Button>
      </div>

      <div class="mt-6">
        <MeetingVotingPanel
          :date="meeting.date"
          :meeting-id="meeting.id"
          :members="members"
        />
      </div>
    </template>

    <p
      v-else
      class="mt-6 text-muted-foreground"
    >
      {{ t('meetings.noMeeting') }}
    </p>
  </div>
</template>
