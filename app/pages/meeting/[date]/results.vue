<script setup lang="ts">
// Large-format voting results (PRD §8) for the meeting's Toastmaster / officers
// to read out. Results are revealed only after a ballot is closed, and only to
// meeting managers (enforced by the API — it returns `results` only then).
import { BarChart3, CalendarDays, Trophy } from '@lucide/vue'

type AwardLabel
  = | { kind: 'speaker', index: number }
    | { kind: 'evaluator', index: number }
    | { kind: 'role', nameEn: string, nameFr: string }

interface ResultRow { id: string | null, name: string | null, isGuest: boolean, excluded: boolean, label: AwardLabel | null, votes: number, isWinner: boolean }
interface CategoryVote {
  category: string
  status: 'draft' | 'open' | 'closed' | null
  results: ResultRow[] | null
  tie: boolean
}
interface VotingData { canManageVoting: boolean, categories: CategoryVote[] }

const route = useRoute()
const date = computed(() => String(route.params.date))
const { locale, t } = useI18n()
const localePath = useLocalePath()

const { data } = await useFetch<VotingData>(() => `/api/meetings/voting/${date.value}`, {
  key: () => `voting-${date.value}`,
})
const canManage = computed(() => data.value?.canManageVoting ?? false)
const categories = computed(() => data.value?.categories ?? [])

function labelText(label: AwardLabel): string {
  if (label.kind === 'speaker') return t('voting.speakerLabel', { n: label.index })
  if (label.kind === 'evaluator') return t('voting.evaluatorLabel', { n: label.index })
  return locale.value === 'fr' ? label.nameFr : label.nameEn
}
const winners = (c: CategoryVote) => (c.results ?? []).filter(r => r.isWinner)

const prettyDate = computed(() => {
  const d = new Date(`${date.value}T00:00:00`)
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(d)
})

useHead(() => ({ title: `${t('voting.resultsTitle')} — ${prettyDate.value}` }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <NuxtLink
      :to="localePath(`/meeting/${date}/vote`)"
      class="text-sm text-muted-foreground hover:text-foreground"
    >
      ← {{ t('voting.backToVoting') }}
    </NuxtLink>

    <div class="mt-3 flex items-center gap-2 text-sm font-medium text-secondary">
      <CalendarDays class="size-4" />
      {{ prettyDate }}
    </div>
    <h1 class="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight">
      <BarChart3 class="size-7" />
      {{ t('voting.resultsTitle') }}
    </h1>

    <!-- Only meeting managers may see results -->
    <p
      v-if="!canManage"
      class="mt-8 text-muted-foreground"
    >
      {{ t('voting.resultsForbidden') }}
    </p>

    <div
      v-else
      class="mt-8 space-y-6"
    >
      <section
        v-for="c in categories"
        :key="c.category"
        class="rounded-xl border border-border p-6"
      >
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {{ t(`voting.categories.${c.category}`) }}
        </h2>

        <!-- Closed: the winner(s), large -->
        <template v-if="c.results">
          <div class="mt-3">
            <div
              v-if="winners(c).length"
              class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-secondary"
            >
              <Trophy class="size-4" />
              {{ c.tie ? t('voting.tieWinners') : t('voting.winner') }}
            </div>
            <div
              v-for="w in winners(c)"
              :key="w.id ?? w.name ?? ''"
              class="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl"
            >
              {{ w.name }}
              <span class="align-middle text-xl font-semibold text-muted-foreground">
                · {{ t('voting.voteCount', { n: w.votes }) }}
              </span>
            </div>
            <p
              v-if="!winners(c).length"
              class="mt-1 text-2xl font-bold text-muted-foreground"
            >
              {{ t('voting.noVotes') }}
            </p>
          </div>

          <!-- Full breakdown -->
          <ul class="mt-4 divide-y divide-border border-t border-border pt-1 text-sm">
            <li
              v-for="(r, i) in c.results"
              :key="r.id ?? `r-${i}`"
              class="flex items-center justify-between gap-3 py-2"
              :class="r.excluded ? 'text-muted-foreground line-through' : ''"
            >
              <span>
                <span
                  v-if="r.label"
                  class="text-muted-foreground"
                >{{ labelText(r.label) }}: </span>
                {{ r.name }}
                <span
                  v-if="r.isGuest"
                  class="text-xs text-muted-foreground no-underline"
                >({{ t('meetings.guest') }})</span>
              </span>
              <span class="font-semibold tabular-nums">{{ t('voting.voteCount', { n: r.votes }) }}</span>
            </li>
          </ul>
        </template>

        <!-- Not yet closed -->
        <p
          v-else
          class="mt-3 text-muted-foreground"
        >
          {{ c.status === 'open' ? t('voting.resultsWhenClosed') : t('voting.resultsNotRun') }}
        </p>
      </section>
    </div>
  </div>
</template>
