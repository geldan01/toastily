<script setup lang="ts">
import { Award, Briefcase, GraduationCap, History, MessageSquare, Mic, Star, UserCheck, Users } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { t, locale } = useI18n()
const localePath = useLocalePath()

type MeetingAttended = { meetingId: string, date: string, meetingNumber: number | null, source: 'self' | 'secretary' }
type RoleTaken = { meetingId: string, date: string, roleNameEn: string, roleNameFr: string }
type SpeechGiven = { meetingId: string, date: string, title: string | null, slot: number }
type EvaluationDone = { meetingId: string, date: string, speechTitle: string | null, slot: number }
type EvaluationReceived = {
  meetingId: string
  date: string
  speechTitle: string | null
  slot: number
  evaluatorName: string | null
  liked: string | null
  recommend: string | null
  structureRating: number
  vocalVarietyRating: number
  gesturesRating: number
  createdAt: string
}
type AwardWin = { category: string, date: string, meetingNumber: number | null, votes: number }
type PositionHeld = { positionNameEn: string, positionNameFr: string, startedAt: string, endedAt: string | null }
type StatusChange = { fromStatus: string | null, toStatus: string, at: string }
type MentorshipLink = { mentorshipId: string, userId: string, name: string }
type Participation = {
  member: {
    id: string
    name: string
    email: string | null
    status: 'member' | 'officer' | 'admin'
    since: string
    bio: string | null
    goals: string | null
    phone: string | null
  }
  attendance: MeetingAttended[]
  roles: RoleTaken[]
  speeches: SpeechGiven[]
  evaluations: EvaluationDone[]
  evaluationsReceived: EvaluationReceived[]
  awards: AwardWin[]
  positions: PositionHeld[]
  statusHistory: StatusChange[]
  mentor: MentorshipLink | null
  mentees: MentorshipLink[]
}

const { data, error, refresh } = await useFetch<Participation>(() => `/api/participation/${id.value}`, {
  key: () => `participation-${id.value}`,
})

const member = computed(() => data.value?.member)

// Mentorship management (issue #62) — only people-managers (admin or a
// canAssignOfficers holder) may set/end pairings; the server enforces it too.
const { data: caps } = useCapabilities()
const canManageMentorship = computed(() => caps.value?.canAssignOfficers ?? false)

const { data: rosterData } = await useFetch<{ members: { id: string, name: string }[] }>(
  '/api/meetings/members',
  { key: 'mentorship-member-picker', immediate: canManageMentorship.value, default: () => ({ members: [] }) },
)
// Members eligible to be paired with this member (exclude self).
const pickableMembers = computed(() =>
  (rosterData.value?.members ?? []).filter(m => m.id !== id.value),
)

const mentorPick = ref('')
const menteePick = ref('')
const busy = ref(false)

async function setMentor() {
  if (!mentorPick.value || busy.value) return
  busy.value = true
  try {
    await $fetch('/api/mentorships', {
      method: 'POST',
      body: { mentorUserId: mentorPick.value, menteeUserId: id.value },
    })
    mentorPick.value = ''
    await refresh()
  }
  finally {
    busy.value = false
  }
}

async function addMentee() {
  if (!menteePick.value || busy.value) return
  busy.value = true
  try {
    await $fetch('/api/mentorships', {
      method: 'POST',
      body: { mentorUserId: id.value, menteeUserId: menteePick.value },
    })
    menteePick.value = ''
    await refresh()
  }
  finally {
    busy.value = false
  }
}

async function endPairing(mentorshipId: string) {
  if (busy.value) return
  busy.value = true
  try {
    await $fetch(`/api/mentorships/${mentorshipId}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busy.value = false
  }
}
const counts = computed(() => {
  const d = data.value
  return [
    { key: 'attended', icon: UserCheck, n: d?.attendance.length ?? 0 },
    { key: 'roles', icon: Users, n: d?.roles.length ?? 0 },
    { key: 'speeches', icon: Mic, n: d?.speeches.length ?? 0 },
    { key: 'evaluations', icon: MessageSquare, n: d?.evaluations.length ?? 0 },
    { key: 'awards', icon: Award, n: d?.awards.length ?? 0 },
  ] as const
})

function fmtMeetingDate(date: string) {
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}
function fmtTimestamp(ts: string) {
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(ts))
}
const localizedRole = (r: RoleTaken) => (locale.value === 'fr' ? r.roleNameFr : r.roleNameEn)
const localizedPosition = (p: PositionHeld) => (locale.value === 'fr' ? p.positionNameFr : p.positionNameEn)
const categoryLabel = (c: string) => t(`voting.categories.${c}`)
const statusLabel = (s: string) => t(`account.status${s.charAt(0).toUpperCase()}${s.slice(1)}`)

useHead(() => ({ title: member.value ? `${member.value.name} — ${t('participation.title')}` : t('participation.title') }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <NuxtLink
      :to="localePath('/participation')"
      class="text-sm text-muted-foreground hover:text-foreground"
    >
      ← {{ t('participation.backToSummary') }}
    </NuxtLink>

    <div
      v-if="error"
      class="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-6 text-center text-muted-foreground"
    >
      {{ t('participation.notFound') }}
    </div>

    <template v-else-if="member">
      <header class="mt-3 mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">
            {{ member.name }}
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ t('participation.memberSince', { date: fmtTimestamp(member.since) }) }}
          </p>
        </div>
        <Badge :variant="member.status === 'member' ? 'outline' : 'default'">
          {{ statusLabel(member.status) }}
        </Badge>
      </header>

      <!-- Profile (issue #61): bio, goals, contact -->
      <section
        v-if="member.bio || member.goals || member.email || member.phone"
        class="mb-8 space-y-3 rounded-lg border bg-muted/30 px-4 py-4"
      >
        <div v-if="member.bio">
          <h2 class="text-sm font-semibold text-secondary">
            {{ t('participation.about') }}
          </h2>
          <p class="mt-0.5 whitespace-pre-line text-sm">
            {{ member.bio }}
          </p>
        </div>
        <div v-if="member.goals">
          <h2 class="text-sm font-semibold text-secondary">
            {{ t('participation.goals') }}
          </h2>
          <p class="mt-0.5 whitespace-pre-line text-sm">
            {{ member.goals }}
          </p>
        </div>
        <div v-if="member.email || member.phone">
          <h2 class="text-sm font-semibold text-secondary">
            {{ t('participation.contact') }}
          </h2>
          <p class="mt-0.5 flex flex-wrap gap-x-4 text-sm">
            <a
              v-if="member.email"
              :href="`mailto:${member.email}`"
              class="hover:underline"
            >{{ member.email }}</a>
            <a
              v-if="member.phone"
              :href="`tel:${member.phone}`"
              class="hover:underline"
            >{{ member.phone }}</a>
          </p>
        </div>
      </section>

      <!-- Mentorship (issue #62): visible on both the mentee's and mentor's page -->
      <section
        v-if="data && (data.mentor || data.mentees.length || canManageMentorship)"
        class="mb-8 space-y-4 rounded-lg border bg-muted/30 px-4 py-4"
      >
        <h2 class="flex items-center gap-2 text-sm font-semibold text-secondary">
          <GraduationCap class="size-4" /> {{ t('mentorship.title') }}
        </h2>

        <!-- Mentored by -->
        <div class="space-y-2">
          <p class="text-sm">
            <span class="text-muted-foreground">{{ t('mentorship.mentoredBy') }}:</span>
            <NuxtLink
              v-if="data.mentor"
              :to="localePath(`/participation/${data.mentor.userId}`)"
              class="ml-1 font-medium hover:underline"
            >{{ data.mentor.name }}</NuxtLink>
            <button
              v-if="data.mentor && canManageMentorship"
              type="button"
              class="ml-2 text-xs text-destructive hover:underline disabled:opacity-50"
              :disabled="busy"
              @click="endPairing(data.mentor.mentorshipId)"
            >
              {{ t('mentorship.remove') }}
            </button>
            <span
              v-if="!data.mentor"
              class="ml-1 text-muted-foreground"
            >{{ t('mentorship.none') }}</span>
          </p>
          <form
            v-if="canManageMentorship"
            class="flex flex-wrap items-center gap-2"
            @submit.prevent="setMentor"
          >
            <select
              v-model="mentorPick"
              class="flex h-9 min-w-48 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <option value="">
                {{ data.mentor ? t('mentorship.changeMentor') : t('mentorship.setMentor') }}
              </option>
              <option
                v-for="m in pickableMembers"
                :key="m.id"
                :value="m.id"
              >
                {{ m.name }}
              </option>
            </select>
            <Button
              type="submit"
              size="sm"
              :disabled="!mentorPick || busy"
            >
              {{ t('mentorship.save') }}
            </Button>
          </form>
        </div>

        <!-- Mentoring -->
        <div class="space-y-2">
          <p class="text-sm text-muted-foreground">
            {{ t('mentorship.mentoring') }}:
          </p>
          <ul
            v-if="data.mentees.length"
            class="space-y-1.5"
          >
            <li
              v-for="m in data.mentees"
              :key="m.mentorshipId"
              class="flex items-center justify-between gap-3 text-sm"
            >
              <NuxtLink
                :to="localePath(`/participation/${m.userId}`)"
                class="font-medium hover:underline"
              >{{ m.name }}</NuxtLink>
              <button
                v-if="canManageMentorship"
                type="button"
                class="text-xs text-destructive hover:underline disabled:opacity-50"
                :disabled="busy"
                @click="endPairing(m.mentorshipId)"
              >
                {{ t('mentorship.remove') }}
              </button>
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-muted-foreground"
          >
            {{ t('mentorship.noMentees') }}
          </p>
          <form
            v-if="canManageMentorship"
            class="flex flex-wrap items-center gap-2"
            @submit.prevent="addMentee"
          >
            <select
              v-model="menteePick"
              class="flex h-9 min-w-48 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <option value="">
                {{ t('mentorship.addMentee') }}
              </option>
              <option
                v-for="m in pickableMembers"
                :key="m.id"
                :value="m.id"
              >
                {{ m.name }}
              </option>
            </select>
            <Button
              type="submit"
              size="sm"
              :disabled="!menteePick || busy"
            >
              {{ t('mentorship.add') }}
            </Button>
          </form>
        </div>
      </section>

      <!-- Summary counts -->
      <div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card
          v-for="c in counts"
          :key="c.key"
        >
          <CardHeader class="items-center gap-1 py-4 text-center">
            <component
              :is="c.icon"
              class="size-5 text-muted-foreground"
            />
            <CardTitle class="text-2xl tabular-nums">
              {{ c.n }}
            </CardTitle>
            <CardDescription>{{ t(`participation.${c.key}`) }}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <!-- Meetings attended -->
      <section
        v-if="data?.attendance.length"
        class="mb-8"
      >
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <UserCheck class="size-5" /> {{ t('participation.meetingsAttended') }}
        </h2>
        <ul class="space-y-2">
          <li
            v-for="(a, i) in data.attendance"
            :key="i"
            class="flex items-baseline justify-between gap-4 rounded-md border px-4 py-2.5"
          >
            <NuxtLink
              :to="localePath(`/meeting/${a.date}`)"
              class="min-w-0 font-medium hover:underline"
            >
              <template v-if="a.meetingNumber != null">{{ t('meetings.meetingNo', { n: a.meetingNumber }) }}</template>
              <template v-else>{{ fmtMeetingDate(a.date) }}</template>
            </NuxtLink>
            <span class="shrink-0 text-sm text-muted-foreground">{{ fmtMeetingDate(a.date) }}</span>
          </li>
        </ul>
      </section>

      <!-- Speeches given -->
      <section
        v-if="data?.speeches.length"
        class="mb-8"
      >
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Mic class="size-5" /> {{ t('participation.speechesGiven') }}
        </h2>
        <ul class="space-y-2">
          <li
            v-for="(s, i) in data.speeches"
            :key="i"
            class="flex items-baseline justify-between gap-4 rounded-md border px-4 py-2.5"
          >
            <NuxtLink
              :to="localePath(`/meeting/${s.date}`)"
              class="min-w-0 hover:underline"
            >
              {{ s.title || t('participation.untitledSpeech') }}
            </NuxtLink>
            <span class="shrink-0 text-sm text-muted-foreground">{{ fmtMeetingDate(s.date) }}</span>
          </li>
        </ul>
      </section>

      <!-- Evaluations received (private — speaker or admin only, issue #60) -->
      <section
        v-if="data?.evaluationsReceived?.length"
        class="mb-8"
      >
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Star class="size-5" /> {{ t('participation.evaluationsReceived') }}
        </h2>
        <ul class="space-y-3">
          <li
            v-for="(e, i) in data.evaluationsReceived"
            :key="i"
            class="rounded-md border px-4 py-3"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <NuxtLink
                :to="localePath(`/meeting/${e.date}`)"
                class="font-medium hover:underline"
              >
                {{ e.speechTitle || t('participation.untitledSpeech') }}
              </NuxtLink>
              <span class="text-sm text-muted-foreground">{{ fmtMeetingDate(e.date) }}</span>
            </div>
            <p
              v-if="e.evaluatorName"
              class="mt-0.5 text-xs text-muted-foreground"
            >
              {{ t('participation.evaluationBy', { name: e.evaluatorName }) }}
            </p>
            <div class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span class="flex items-center gap-2">
                <span class="text-muted-foreground">{{ t('meetings.evalStructure') }}</span>
                <StarRating
                  :model-value="e.structureRating"
                  readonly
                />
              </span>
              <span class="flex items-center gap-2">
                <span class="text-muted-foreground">{{ t('meetings.evalVocalVariety') }}</span>
                <StarRating
                  :model-value="e.vocalVarietyRating"
                  readonly
                />
              </span>
              <span class="flex items-center gap-2">
                <span class="text-muted-foreground">{{ t('meetings.evalGestures') }}</span>
                <StarRating
                  :model-value="e.gesturesRating"
                  readonly
                />
              </span>
            </div>
            <dl
              v-if="e.liked || e.recommend"
              class="mt-2 space-y-1 text-sm"
            >
              <div v-if="e.liked">
                <dt class="inline font-medium text-secondary">
                  {{ t('meetings.evalLiked') }}:
                </dt>
                <dd class="inline whitespace-pre-line">
                  {{ e.liked }}
                </dd>
              </div>
              <div v-if="e.recommend">
                <dt class="inline font-medium text-secondary">
                  {{ t('meetings.evalRecommend') }}:
                </dt>
                <dd class="inline whitespace-pre-line">
                  {{ e.recommend }}
                </dd>
              </div>
            </dl>
          </li>
        </ul>
      </section>

      <!-- Evaluations done -->
      <section
        v-if="data?.evaluations.length"
        class="mb-8"
      >
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <MessageSquare class="size-5" /> {{ t('participation.evaluationsDone') }}
        </h2>
        <ul class="space-y-2">
          <li
            v-for="(e, i) in data.evaluations"
            :key="i"
            class="flex items-baseline justify-between gap-4 rounded-md border px-4 py-2.5"
          >
            <NuxtLink
              :to="localePath(`/meeting/${e.date}`)"
              class="min-w-0 hover:underline"
            >
              {{ e.speechTitle || t('participation.untitledSpeech') }}
            </NuxtLink>
            <span class="shrink-0 text-sm text-muted-foreground">{{ fmtMeetingDate(e.date) }}</span>
          </li>
        </ul>
      </section>

      <!-- Awards won -->
      <section
        v-if="data?.awards.length"
        class="mb-8"
      >
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Award class="size-5" /> {{ t('participation.awardsWon') }}
        </h2>
        <ul class="space-y-2">
          <li
            v-for="(a, i) in data.awards"
            :key="i"
            class="flex items-baseline justify-between gap-4 rounded-md border px-4 py-2.5"
          >
            <span class="flex items-center gap-2">
              <Badge variant="secondary">{{ categoryLabel(a.category) }}</Badge>
            </span>
            <NuxtLink
              :to="localePath(`/meeting/${a.date}`)"
              class="shrink-0 text-sm text-muted-foreground hover:underline"
            >{{ fmtMeetingDate(a.date) }}</NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Roles taken -->
      <section
        v-if="data?.roles.length"
        class="mb-8"
      >
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Users class="size-5" /> {{ t('participation.rolesTaken') }}
        </h2>
        <ul class="space-y-2">
          <li
            v-for="(r, i) in data.roles"
            :key="i"
            class="flex items-baseline justify-between gap-4 rounded-md border px-4 py-2.5"
          >
            <NuxtLink
              :to="localePath(`/meeting/${r.date}`)"
              class="min-w-0 font-medium hover:underline"
            >
              {{ localizedRole(r) }}
            </NuxtLink>
            <span class="shrink-0 text-sm text-muted-foreground">{{ fmtMeetingDate(r.date) }}</span>
          </li>
        </ul>
      </section>

      <!-- Executive positions -->
      <section
        v-if="data?.positions.length"
        class="mb-8"
      >
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Briefcase class="size-5" /> {{ t('participation.positionsHeld') }}
        </h2>
        <ul class="space-y-2">
          <li
            v-for="(p, i) in data.positions"
            :key="i"
            class="flex items-baseline justify-between gap-4 rounded-md border px-4 py-2.5"
          >
            <span class="font-medium">{{ localizedPosition(p) }}</span>
            <span class="shrink-0 text-sm text-muted-foreground">
              {{ fmtTimestamp(p.startedAt) }} – {{ p.endedAt ? fmtTimestamp(p.endedAt) : t('participation.present') }}
            </span>
          </li>
        </ul>
      </section>

      <!-- Account status history -->
      <section
        v-if="data?.statusHistory.length"
        class="mb-8"
      >
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <History class="size-5" /> {{ t('participation.statusHistory') }}
        </h2>
        <ul class="space-y-2">
          <li
            v-for="(s, i) in data.statusHistory"
            :key="i"
            class="flex items-baseline justify-between gap-4 rounded-md border px-4 py-2.5 text-sm"
          >
            <span>
              <template v-if="s.fromStatus">{{ statusLabel(s.fromStatus) }} → </template>{{ statusLabel(s.toStatus) }}
            </span>
            <span class="shrink-0 text-muted-foreground">{{ fmtTimestamp(s.at) }}</span>
          </li>
        </ul>
      </section>

      <p
        v-if="!data?.attendance.length && !data?.roles.length && !data?.speeches.length && !data?.evaluations.length && !data?.awards.length && !data?.positions.length"
        class="rounded-lg border px-4 py-10 text-center text-muted-foreground"
      >
        {{ t('participation.noActivity') }}
      </p>
    </template>
  </div>
</template>
