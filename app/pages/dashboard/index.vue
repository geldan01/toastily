<script setup lang="ts">
import { Award, CalendarCheck, ClipboardList, FileText, History, Mic, UserCheck, Users } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { user } = useUserSession()

type RoleCommitment = { roleNameEn: string, roleNameFr: string }
type SpeakingCommitment = { slot: number, title: string | null, minMinutes: number | null, maxMinutes: number | null }
type EvaluatingCommitment = { slot: number, speechTitle: string | null }
type UpcomingMeeting = {
  meetingId: string
  date: string
  meetingNumber: number | null
  themeEn: string | null
  themeFr: string | null
  roles: RoleCommitment[]
  speaking: SpeakingCommitment[]
  evaluating: EvaluatingCommitment[]
}
type Attended = { meetingId: string, date: string, meetingNumber: number | null, source: 'self' | 'secretary' }
type RoleTaken = { meetingId: string, date: string, roleNameEn: string, roleNameFr: string }
type SpeechGiven = { meetingId: string, date: string, title: string | null, slot: number }
type Dashboard = {
  memberId: string
  nextMeeting: { date: string, meetingNumber: number | null } | null
  upcoming: UpcomingMeeting[]
  recent: { attended: Attended[], roles: RoleTaken[], speeches: SpeechGiven[] }
}

const { data } = await useFetch<Dashboard>('/api/me/dashboard', {
  key: 'my-dashboard',
  default: () => ({ memberId: '', nextMeeting: null, upcoming: [], recent: { attended: [], roles: [], speeches: [] } }),
})

const nextMeeting = computed(() => data.value?.nextMeeting ?? null)
const upcoming = computed(() => data.value?.upcoming ?? [])
const recent = computed(() => data.value?.recent ?? { attended: [], roles: [], speeches: [] })
const memberId = computed(() => data.value?.memberId ?? '')
const hasRecent = computed(() =>
  recent.value.attended.length || recent.value.roles.length || recent.value.speeches.length)

const roleLabel = (r: { roleNameEn: string, roleNameFr: string }) => (locale.value === 'fr' ? r.roleNameFr : r.roleNameEn)
const theme = (m: UpcomingMeeting) => (locale.value === 'fr' ? m.themeFr : m.themeEn)

// Meeting date is a YYYY-MM-DD string — anchor to local midnight to avoid TZ drift.
function fmtMeetingDate(date: string) {
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

useHead(() => ({ title: t('dashboard.title') }))
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12">
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('dashboard.greeting', { name: user?.name ?? '' }) }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('dashboard.subtitle') }}
      </p>
    </header>

    <!-- Quick actions for the next meeting -->
    <section
      v-if="nextMeeting"
      class="mb-10"
    >
      <h2 class="mb-3 flex items-center gap-2 text-xl font-semibold tracking-tight">
        <CalendarCheck class="size-5" /> {{ t('dashboard.nextMeeting') }}
      </h2>
      <Card>
        <CardHeader>
          <CardTitle class="text-base">
            <template v-if="nextMeeting.meetingNumber != null">
              {{ t('meetings.meetingNo', { n: nextMeeting.meetingNumber }) }} ·
            </template>{{ fmtMeetingDate(nextMeeting.date) }}
          </CardTitle>
        </CardHeader>
        <CardContent class="flex flex-wrap gap-2">
          <Button
            as-child
            variant="default"
            size="sm"
          >
            <NuxtLink :to="localePath(`/meeting/${nextMeeting.date}`)">
              <FileText class="size-4" /> {{ t('dashboard.viewAgenda') }}
            </NuxtLink>
          </Button>
          <Button
            as-child
            variant="outline"
            size="sm"
          >
            <NuxtLink :to="localePath(`/meeting/${nextMeeting.date}/signup`)">
              <ClipboardList class="size-4" /> {{ t('meetings.signUp') }}
            </NuxtLink>
          </Button>
          <Button
            as-child
            variant="outline"
            size="sm"
          >
            <NuxtLink :to="localePath(`/meeting/${nextMeeting.date}/attendance`)">
              <UserCheck class="size-4" /> {{ t('meetings.attendanceTitle') }}
            </NuxtLink>
          </Button>
        </CardContent>
      </Card>
    </section>

    <!-- Upcoming commitments -->
    <section class="mb-10">
      <h2 class="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
        <CalendarCheck class="size-5" /> {{ t('dashboard.upcomingCommitments') }}
      </h2>

      <Card
        v-if="!upcoming.length"
        class="opacity-70"
      >
        <CardHeader>
          <CardDescription>
            {{ nextMeeting ? t('dashboard.noCommitments') : t('dashboard.noUpcomingMeetings') }}
          </CardDescription>
        </CardHeader>
      </Card>

      <ul
        v-else
        class="space-y-3"
      >
        <li
          v-for="m in upcoming"
          :key="m.meetingId"
        >
          <Card>
            <CardHeader class="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <div class="min-w-0">
                <CardTitle class="text-base">
                  <NuxtLink
                    :to="localePath(`/meeting/${m.date}`)"
                    class="hover:underline"
                  >
                    <template v-if="m.meetingNumber != null">{{ t('meetings.meetingNo', { n: m.meetingNumber }) }} · </template>{{ fmtMeetingDate(m.date) }}
                  </NuxtLink>
                </CardTitle>
                <CardDescription v-if="theme(m)">
                  {{ theme(m) }}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent class="space-y-4">
              <!-- Roles -->
              <div v-if="m.roles.length">
                <h3 class="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-secondary">
                  <Users class="size-4" /> {{ t('dashboard.myRoles') }}
                </h3>
                <div class="flex flex-wrap gap-1.5">
                  <Badge
                    v-for="(r, i) in m.roles"
                    :key="i"
                    variant="secondary"
                  >
                    {{ roleLabel(r) }}
                  </Badge>
                </div>
              </div>

              <!-- Speaking -->
              <div v-if="m.speaking.length">
                <h3 class="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-secondary">
                  <Mic class="size-4" /> {{ t('dashboard.mySpeeches') }}
                </h3>
                <ul class="space-y-1 text-sm">
                  <li
                    v-for="s in m.speaking"
                    :key="s.slot"
                    class="flex flex-wrap items-baseline gap-x-2"
                  >
                    <span class="font-medium">{{ s.title || t('meetings.untitledSpeech') }}</span>
                    <span
                      v-if="s.minMinutes != null && s.maxMinutes != null"
                      class="text-muted-foreground"
                    >
                      {{ s.minMinutes }}–{{ s.maxMinutes }} {{ t('meetings.minShort') }}
                    </span>
                  </li>
                </ul>
              </div>

              <!-- Evaluating -->
              <div v-if="m.evaluating.length">
                <h3 class="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-secondary">
                  <ClipboardList class="size-4" /> {{ t('dashboard.myEvaluations') }}
                </h3>
                <ul class="space-y-1 text-sm">
                  <li
                    v-for="e in m.evaluating"
                    :key="e.slot"
                  >
                    {{ e.speechTitle || t('meetings.untitledSpeech') }}
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </li>
      </ul>
    </section>

    <!-- Recent activity -->
    <section>
      <h2 class="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
        <History class="size-5" /> {{ t('dashboard.recentActivity') }}
      </h2>

      <Card
        v-if="!hasRecent"
        class="opacity-70"
      >
        <CardHeader>
          <CardDescription>{{ t('participation.noActivity') }}</CardDescription>
        </CardHeader>
      </Card>

      <div
        v-else
        class="grid gap-4 sm:grid-cols-3"
      >
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="flex items-center gap-1.5 text-sm">
              <UserCheck class="size-4" /> {{ t('participation.meetingsAttended') }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul
              v-if="recent.attended.length"
              class="space-y-1 text-sm"
            >
              <li
                v-for="a in recent.attended"
                :key="a.meetingId"
                class="text-muted-foreground"
              >
                {{ fmtMeetingDate(a.date) }}
              </li>
            </ul>
            <p
              v-else
              class="text-sm text-muted-foreground"
            >
              —
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="flex items-center gap-1.5 text-sm">
              <Users class="size-4" /> {{ t('participation.rolesTaken') }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul
              v-if="recent.roles.length"
              class="space-y-1 text-sm"
            >
              <li
                v-for="(r, i) in recent.roles"
                :key="i"
              >
                {{ roleLabel(r) }}
                <span class="text-muted-foreground">· {{ fmtMeetingDate(r.date) }}</span>
              </li>
            </ul>
            <p
              v-else
              class="text-sm text-muted-foreground"
            >
              —
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="flex items-center gap-1.5 text-sm">
              <Mic class="size-4" /> {{ t('participation.speechesGiven') }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul
              v-if="recent.speeches.length"
              class="space-y-1 text-sm"
            >
              <li
                v-for="s in recent.speeches"
                :key="s.meetingId + '-' + s.slot"
              >
                {{ s.title || t('participation.untitledSpeech') }}
                <span class="text-muted-foreground">· {{ fmtMeetingDate(s.date) }}</span>
              </li>
            </ul>
            <p
              v-else
              class="text-sm text-muted-foreground"
            >
              —
            </p>
          </CardContent>
        </Card>
      </div>

      <div
        v-if="memberId"
        class="mt-4"
      >
        <Button
          as-child
          variant="link"
          size="sm"
          class="px-0"
        >
          <NuxtLink :to="localePath(`/participation/${memberId}`)">
            <Award class="size-4" /> {{ t('dashboard.viewFullHistory') }}
          </NuxtLink>
        </Button>
      </div>
    </section>
  </div>
</template>
