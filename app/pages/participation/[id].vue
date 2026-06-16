<script setup lang="ts">
import { Award, Briefcase, History, MessageSquare, Mic, Users } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { t, locale } = useI18n()
const localePath = useLocalePath()

type RoleTaken = { meetingId: string, date: string, roleNameEn: string, roleNameFr: string }
type SpeechGiven = { meetingId: string, date: string, title: string | null, slot: number }
type EvaluationDone = { meetingId: string, date: string, speechTitle: string | null, slot: number }
type AwardWin = { category: string, date: string, meetingNumber: number | null, votes: number }
type PositionHeld = { positionNameEn: string, positionNameFr: string, startedAt: string, endedAt: string | null }
type StatusChange = { fromStatus: string | null, toStatus: string, at: string }
type Participation = {
  member: { id: string, name: string, email: string, status: 'member' | 'officer' | 'admin', since: string }
  roles: RoleTaken[]
  speeches: SpeechGiven[]
  evaluations: EvaluationDone[]
  awards: AwardWin[]
  positions: PositionHeld[]
  statusHistory: StatusChange[]
}

const { data, error } = await useFetch<Participation>(() => `/api/participation/${id.value}`, {
  key: () => `participation-${id.value}`,
})

const member = computed(() => data.value?.member)
const counts = computed(() => {
  const d = data.value
  return [
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

      <!-- Summary counts -->
      <div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        v-if="!data?.roles.length && !data?.speeches.length && !data?.evaluations.length && !data?.awards.length && !data?.positions.length"
        class="rounded-lg border px-4 py-10 text-center text-muted-foreground"
      >
        {{ t('participation.noActivity') }}
      </p>
    </template>
  </div>
</template>
