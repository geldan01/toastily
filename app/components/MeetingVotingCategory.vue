<script setup lang="ts">
// One award category's body for the voting panel (PRD §8): the candidate list
// with per-candidate controls, plus the closed-ballot results. The parent
// (MeetingVotingPanel) owns the ballot lifecycle (open/close) and the grouping of
// the two Table Topics ballots. Best Speaker / Best Evaluator candidates are
// derived from the meeting's speeches (+ Grammarian) and numbered ("Speaker 1",
// "Evaluator 2", "Grammarian"); table-topics candidates are added live. Managers
// can strike out (disqualify) a candidate; anyone present votes once while the
// ballot is `open`; results show after it's `closed`.
import { Ban, RotateCcw, Trophy, UserPlus, Vote, X } from '@lucide/vue'

type AwardLabel
  = | { kind: 'speaker', index: number }
    | { kind: 'evaluator', index: number }
    | { kind: 'role', nameEn: string, nameFr: string }

interface Member { id: string, name: string }
interface Candidate { id: string | null, name: string | null, isGuest: boolean, excluded: boolean, label: AwardLabel | null }
interface ResultRow extends Candidate { votes: number, isWinner: boolean }
interface CategoryVote {
  category: string
  sessionId: string | null
  status: 'draft' | 'open' | 'closed' | null
  candidates: Candidate[]
  myCandidateId: string | null
  hasVoted: boolean
  results: ResultRow[] | null
  tie: boolean
}
type AssignTarget = { userId: string } | { guestName: string }

const props = defineProps<{ category: CategoryVote, canManage: boolean, members: Member[], busy: string }>()
const emit = defineEmits<{
  vote: [sessionId: string, candidateId: string]
  add: [sessionId: string, target: AssignTarget]
  exclude: [candidateId: string, excluded: boolean]
  remove: [candidateId: string]
}>()

const { t, locale } = useI18n()

// Best Speaker / Best Evaluator candidates are derived from the speeches; only
// the table-topics ballots take manually-added candidates.
const derivable = computed(() => props.category.category === 'best_speaker' || props.category.category === 'best_evaluator')

const addOpen = ref(false)
const rowKey = (id: string) => `${props.category.category}:${id}`

function labelText(label: AwardLabel): string {
  if (label.kind === 'speaker') return t('voting.speakerLabel', { n: label.index })
  if (label.kind === 'evaluator') return t('voting.evaluatorLabel', { n: label.index })
  return locale.value === 'fr' ? label.nameFr : label.nameEn
}

function onAssign(target: AssignTarget) {
  if (props.category.sessionId) emit('add', props.category.sessionId, target)
  addOpen.value = false
}
</script>

<template>
  <div>
    <!-- Not closed: the candidate list — a preview before the ballot opens
         (speech nominees are derived and shown right away), votable once open. -->
    <template v-if="category.status !== 'closed'">
      <p
        v-if="canManage && category.status !== 'open'"
        class="mt-2 text-sm text-muted-foreground/70"
      >
        {{ derivable ? t('voting.prepareHint') : t('voting.prepareHintTT') }}
      </p>
      <p
        v-else-if="category.status !== 'open'"
        class="mt-2 text-sm text-muted-foreground/70"
      >
        {{ t('voting.notOpenYet') }}
      </p>
      <p
        v-if="!category.candidates.length"
        class="mt-2 text-sm text-muted-foreground/70"
      >
        {{ t('voting.noCandidates') }}
      </p>
      <ul
        v-else
        class="mt-3 divide-y divide-border rounded-md border border-border"
      >
        <li
          v-for="(cand, i) in category.candidates"
          :key="cand.id ?? `preview-${i}`"
          class="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
          :class="cand.id && category.myCandidateId === cand.id ? 'bg-secondary/10' : ''"
        >
          <div
            class="text-sm"
            :class="cand.excluded ? 'text-muted-foreground line-through' : ''"
          >
            <span
              v-if="cand.label"
              class="font-medium"
            >{{ labelText(cand.label) }}: </span>
            {{ cand.name }}
            <span
              v-if="cand.isGuest"
              class="text-xs text-muted-foreground no-underline"
            >({{ t('meetings.guest') }})</span>
            <span
              v-if="cand.excluded"
              class="ml-1 text-xs text-muted-foreground no-underline"
            >· {{ t('voting.excludedLabel') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <!-- Vote (open ballots, votable candidates only) -->
            <template v-if="category.status === 'open' && !cand.excluded && cand.id">
              <span
                v-if="category.myCandidateId === cand.id"
                class="text-xs font-medium text-secondary"
              >{{ t('voting.yourVote') }}</span>
              <Button
                size="sm"
                :variant="category.myCandidateId === cand.id ? 'secondary' : 'outline'"
                :disabled="busy === rowKey(cand.id)"
                @click="emit('vote', category.sessionId!, cand.id)"
              >
                <Vote class="size-4" />
                {{ category.myCandidateId === cand.id ? t('voting.voted') : t('voting.vote') }}
              </Button>
            </template>

            <!-- Manager: strike out / restore (disqualify), and — for table
                 topics only — hard-remove a mistaken entry. -->
            <template v-if="canManage && cand.id">
              <Button
                size="sm"
                variant="ghost"
                class="text-muted-foreground"
                :disabled="busy === rowKey(cand.id)"
                :title="cand.excluded ? t('voting.restore') : t('voting.exclude')"
                @click="emit('exclude', cand.id, !cand.excluded)"
              >
                <RotateCcw
                  v-if="cand.excluded"
                  class="size-4"
                />
                <Ban
                  v-else
                  class="size-4"
                />
              </Button>
              <Button
                v-if="!derivable"
                size="sm"
                variant="ghost"
                class="text-muted-foreground hover:text-destructive"
                :disabled="busy === rowKey(cand.id)"
                @click="emit('remove', cand.id)"
              >
                <X class="size-4" />
              </Button>
            </template>
          </div>
        </li>
      </ul>

      <!-- Manager: add a table-topics candidate (member or guest) -->
      <div
        v-if="canManage && !derivable && category.sessionId"
        class="mt-3"
      >
        <Button
          size="sm"
          variant="ghost"
          :disabled="busy === category.category"
          @click="addOpen = !addOpen"
        >
          <UserPlus class="size-4" />
          {{ t('voting.addCandidate') }}
        </Button>
        <MeetingAssignPanel
          v-if="addOpen"
          :id-prefix="`vote-${category.category}`"
          :members="members"
          :busy="busy === category.category"
          class="mt-2"
          @assign="onAssign"
        />
      </div>
    </template>

    <!-- Closed: results for managers, a note for everyone else -->
    <template v-else>
      <ul
        v-if="category.results"
        class="mt-3 divide-y divide-border rounded-md border border-border"
      >
        <li
          v-for="(r, i) in category.results"
          :key="r.id ?? `result-${i}`"
          class="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
          :class="r.isWinner ? 'bg-secondary/10' : ''"
        >
          <span
            class="flex items-center gap-2"
            :class="r.excluded ? 'text-muted-foreground line-through' : ''"
          >
            <span>
              <span
                v-if="r.label"
                class="font-medium"
              >{{ labelText(r.label) }}: </span>
              {{ r.name }}
              <span
                v-if="r.isGuest"
                class="text-xs text-muted-foreground no-underline"
              >({{ t('meetings.guest') }})</span>
            </span>
            <span
              v-if="r.isWinner"
              class="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-medium text-secondary no-underline"
            >
              <Trophy class="size-3" />
              {{ category.tie ? t('voting.tie') : t('voting.winner') }}
            </span>
          </span>
          <span class="font-semibold tabular-nums">{{ t('voting.voteCount', { n: r.votes }) }}</span>
        </li>
      </ul>
      <p
        v-else
        class="mt-2 text-sm text-muted-foreground/70"
      >
        {{ t('voting.closedNoResults') }}
      </p>
    </template>
  </div>
</template>
