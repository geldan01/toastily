<script setup lang="ts">
// In-meeting award voting (PRD §8). Self-contained: fetches the meeting's ballot
// status and renders the four award categories. Meeting managers (officer/admin
// OR the meeting's Sergeant-at-Arms / Toastmaster) open/close ballots and manage
// candidates; anyone present votes once per category via an anonymous device
// cookie. Tallies stay hidden until a ballot is closed, and only managers see them.
import { UserPlus, Vote, X } from '@lucide/vue'

interface Member { id: string, name: string }
interface Candidate { id: string, userId: string | null, name: string | null, isGuest: boolean }
interface ResultRow extends Candidate { votes: number }
interface CategoryVote {
  category: string
  sessionId: string | null
  status: 'open' | 'closed' | null
  candidates: Candidate[]
  myCandidateId: string | null
  hasVoted: boolean
  results: ResultRow[] | null
}
interface VotingData { canManageVoting: boolean, categories: CategoryVote[] }

const props = defineProps<{ date: string, meetingId: string, members: Member[] }>()

const { t } = useI18n()

const { data, refresh } = await useFetch<VotingData>(() => `/api/meetings/voting/${props.date}`, {
  key: () => `voting-${props.date}`,
})

const canManage = computed(() => data.value?.canManageVoting ?? false)
const categories = computed(() => data.value?.categories ?? [])

const busy = ref('')
const error = ref('')
type AssignTarget = { userId: string } | { guestName: string }

// Which category's add-candidate panel is open (one at a time).
const addFor = ref<string | null>(null)
function toggleAdd(category: string) {
  addFor.value = addFor.value === category ? null : category
}

async function run(key: string, fn: () => Promise<unknown>) {
  busy.value = key
  error.value = ''
  try {
    await fn()
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = '' }
}

const open = (category: string) =>
  run(category, () => $fetch('/api/meetings/voting/open', { method: 'POST', body: { meetingId: props.meetingId, category } }))

const close = (sessionId: string, category: string) =>
  run(category, () => $fetch('/api/meetings/voting/close', { method: 'POST', body: { sessionId } }))

function addCandidate(sessionId: string, category: string, target: AssignTarget) {
  return run(category, async () => {
    await $fetch('/api/meetings/voting/candidate', { method: 'POST', body: { sessionId, ...target } })
    addFor.value = null
  })
}

const removeCandidate = (candidateId: string, category: string) =>
  run(`${category}:${candidateId}`, () => $fetch('/api/meetings/voting/candidate', { method: 'DELETE', body: { candidateId } }))

const vote = (sessionId: string, candidateId: string, category: string) =>
  run(`${category}:${candidateId}`, () => $fetch('/api/meetings/voting/vote', { method: 'POST', body: { sessionId, candidateId } }))
</script>

<template>
  <section>
    <h2 class="mt-8 text-xl font-semibold">
      {{ t('voting.title') }}
    </h2>
    <p
      v-if="!canManage"
      class="mt-1 text-sm text-muted-foreground"
    >
      {{ t('voting.voterHint') }}
    </p>

    <div
      v-if="error"
      class="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {{ error }}
    </div>

    <div class="mt-3 space-y-3">
      <div
        v-for="c in categories"
        :key="c.category"
        class="rounded-lg border border-border p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-medium">
            {{ t(`voting.categories.${c.category}`) }}
          </div>
          <div class="flex items-center gap-2">
            <span
              v-if="c.status"
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="c.status === 'open'
                ? 'bg-secondary/15 text-secondary'
                : 'bg-muted text-muted-foreground'"
            >
              {{ c.status === 'open' ? t('voting.statusOpen') : t('voting.statusClosed') }}
            </span>

            <!-- Manager: open / close / reopen -->
            <template v-if="canManage">
              <Button
                v-if="!c.status"
                size="sm"
                variant="outline"
                :disabled="busy === c.category"
                @click="open(c.category)"
              >
                {{ t('voting.open') }}
              </Button>
              <Button
                v-else-if="c.status === 'open'"
                size="sm"
                variant="ghost"
                :disabled="busy === c.category"
                @click="close(c.sessionId!, c.category)"
              >
                {{ t('voting.close') }}
              </Button>
              <Button
                v-else
                size="sm"
                variant="ghost"
                :disabled="busy === c.category"
                @click="open(c.category)"
              >
                {{ t('voting.reopen') }}
              </Button>
            </template>
          </div>
        </div>

        <!-- Not yet opened -->
        <p
          v-if="!c.status"
          class="mt-2 text-sm text-muted-foreground/70"
        >
          {{ t('voting.notOpened') }}
        </p>

        <!-- Open ballot: candidate list with vote buttons -->
        <template v-else-if="c.status === 'open'">
          <p
            v-if="!c.candidates.length"
            class="mt-2 text-sm text-muted-foreground/70"
          >
            {{ t('voting.noCandidates') }}
          </p>
          <ul
            v-else
            class="mt-3 divide-y divide-border rounded-md border border-border"
          >
            <li
              v-for="cand in c.candidates"
              :key="cand.id"
              class="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
              :class="c.myCandidateId === cand.id ? 'bg-secondary/10' : ''"
            >
              <div class="text-sm">
                {{ cand.name }}
                <span
                  v-if="cand.isGuest"
                  class="text-xs text-muted-foreground"
                >({{ t('meetings.guest') }})</span>
              </div>
              <div class="flex items-center gap-2">
                <span
                  v-if="c.myCandidateId === cand.id"
                  class="text-xs font-medium text-secondary"
                >{{ t('voting.yourVote') }}</span>
                <Button
                  size="sm"
                  :variant="c.myCandidateId === cand.id ? 'secondary' : 'outline'"
                  :disabled="busy === `${c.category}:${cand.id}`"
                  @click="vote(c.sessionId!, cand.id, c.category)"
                >
                  <Vote class="size-4" />
                  {{ c.myCandidateId === cand.id ? t('voting.voted') : t('voting.vote') }}
                </Button>
                <Button
                  v-if="canManage"
                  size="sm"
                  variant="ghost"
                  class="text-muted-foreground hover:text-destructive"
                  :disabled="busy === `${c.category}:${cand.id}`"
                  @click="removeCandidate(cand.id, c.category)"
                >
                  <X class="size-4" />
                </Button>
              </div>
            </li>
          </ul>

          <!-- Manager: add a candidate (member or guest) -->
          <div
            v-if="canManage"
            class="mt-3"
          >
            <Button
              size="sm"
              variant="ghost"
              :disabled="busy === c.category"
              @click="toggleAdd(c.category)"
            >
              <UserPlus class="size-4" />
              {{ t('voting.addCandidate') }}
            </Button>
            <MeetingAssignPanel
              v-if="addFor === c.category"
              :id-prefix="`vote-${c.category}`"
              :members="props.members"
              :busy="busy === c.category"
              class="mt-2"
              @assign="target => addCandidate(c.sessionId!, c.category, target)"
            />
          </div>
        </template>

        <!-- Closed ballot -->
        <template v-else>
          <!-- Manager: results tally (ties shown as equal counts) -->
          <ul
            v-if="c.results"
            class="mt-3 divide-y divide-border rounded-md border border-border"
          >
            <li
              v-for="r in c.results"
              :key="r.id"
              class="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <span>
                {{ r.name }}
                <span
                  v-if="r.isGuest"
                  class="text-xs text-muted-foreground"
                >({{ t('meetings.guest') }})</span>
              </span>
              <span class="font-semibold tabular-nums">{{ t('voting.voteCount', { n: r.votes }) }}</span>
            </li>
          </ul>
          <!-- Everyone else: closed, no tally -->
          <p
            v-else
            class="mt-2 text-sm text-muted-foreground/70"
          >
            {{ t('voting.closedNoResults') }}
          </p>
        </template>
      </div>
    </div>
  </section>
</template>
