<script setup lang="ts">
// In-meeting award voting (PRD §8), shown on the dedicated /meeting/[date]/vote
// page. Best Speaker / Best Evaluator candidates are derived from the meeting's
// speeches (+ Grammarian) and shown automatically — numbered "Speaker 1",
// "Evaluator 2", "Grammarian"; the two Table Topics ballots are filled live by
// the manager and opened/closed together. A meeting manager (officer/admin OR the
// meeting's Sergeant-at-Arms / Toastmaster) opens each ballot for voting and
// closes it to reveal results; voting is possible only while open. Anyone present
// votes once per category via an anonymous device cookie. Managers may strike out
// (disqualify) a candidate before or during voting.

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
interface VotingData { canManageVoting: boolean, meetingId: string, categories: CategoryVote[] }
type AssignTarget = { userId: string } | { guestName: string }
type GroupStatus = 'draft' | 'open' | 'closed' | null

const SPEECH_CATEGORIES = ['best_speaker', 'best_evaluator']
const TABLE_TOPICS_CATEGORIES = ['best_table_topics_speaker', 'best_table_topics_evaluator']
const ALL_CATEGORIES = [...SPEECH_CATEGORIES, ...TABLE_TOPICS_CATEGORIES]

const props = defineProps<{ date: string, meetingId: string, members: Member[], guests?: { name: string }[] }>()

const { t } = useI18n()

const { data, refresh } = await useFetch<VotingData>(() => `/api/meetings/voting/${props.date}`, {
  key: () => `voting-${props.date}`,
})

const canManage = computed(() => data.value?.canManageVoting ?? false)
const byCategory = computed(() => new Map((data.value?.categories ?? []).map(c => [c.category, c])))
const speechCategories = computed(() => SPEECH_CATEGORIES.map(c => byCategory.value.get(c)).filter((c): c is CategoryVote => !!c))
const tableTopicsCategories = computed(() => TABLE_TOPICS_CATEGORIES.map(c => byCategory.value.get(c)).filter((c): c is CategoryVote => !!c))

// Combined status of the Table Topics pair (open wins, then draft, then closed).
const tableTopicsStatus = computed<GroupStatus>(() => {
  const list = tableTopicsCategories.value
  if (list.some(c => c.status === 'open')) return 'open'
  if (list.some(c => c.status === 'draft')) return 'draft'
  if (list.length && list.every(c => c.status === 'closed')) return 'closed'
  return null
})
const tableTopicsSessionIds = computed(() =>
  tableTopicsCategories.value.map(c => c.sessionId).filter((id): id is string => !!id))

const busy = ref('')
const error = ref('')

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

const openBallots = (categories: string[], key: string) =>
  run(key, () => $fetch('/api/meetings/voting/open', { method: 'POST', body: { meetingId: props.meetingId, categories } }))

const closeBallots = (sessionIds: string[], key: string) =>
  run(key, () => $fetch('/api/meetings/voting/close', { method: 'POST', body: { sessionIds } }))

const addCandidate = (sessionId: string, key: string, target: AssignTarget) =>
  run(key, () => $fetch('/api/meetings/voting/candidate', { method: 'POST', body: { sessionId, ...target } }))

const toggleExclude = (candidateId: string, excluded: boolean, key: string) =>
  run(key, () => $fetch('/api/meetings/voting/candidate', { method: 'PATCH', body: { candidateId, excluded } }))

const removeCandidate = (candidateId: string, key: string) =>
  run(key, () => $fetch('/api/meetings/voting/candidate', { method: 'DELETE', body: { candidateId } }))

const vote = (sessionId: string, candidateId: string, key: string) =>
  run(key, () => $fetch('/api/meetings/voting/vote', { method: 'POST', body: { sessionId, candidateId } }))

// When a manager opens the page, materialise the draft ballots so speech
// candidates (speakers/evaluators/grammarian) are persisted and disqualifiable
// before opening, and the table-topics drafts are ready to fill. Silent + once.
const autoPrepared = ref(false)
async function autoPrepare() {
  if (autoPrepared.value || !canManage.value) return
  autoPrepared.value = true
  try {
    await $fetch('/api/meetings/voting/prepare', { method: 'POST', body: { meetingId: props.meetingId, categories: ALL_CATEGORIES } })
    await refresh()
  }
  catch { /* non-fatal — the candidate preview still renders from the speeches */ }
}
onMounted(autoPrepare)

function statusLabel(status: GroupStatus) {
  if (status === 'open') return t('voting.statusOpen')
  if (status === 'closed') return t('voting.statusClosed')
  if (status === 'draft') return t('voting.statusDraft')
  return ''
}
</script>

<template>
  <section>
    <p
      v-if="!canManage"
      class="text-sm text-muted-foreground"
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
      <!-- Best Speaker / Best Evaluator — independent ballots -->
      <div
        v-for="c in speechCategories"
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
              {{ statusLabel(c.status) }}
            </span>

            <template v-if="canManage">
              <Button
                v-if="c.status === 'open'"
                size="sm"
                variant="ghost"
                :disabled="busy === c.category"
                @click="closeBallots([c.sessionId!], c.category)"
              >
                {{ t('voting.close') }}
              </Button>
              <Button
                v-else
                size="sm"
                :variant="c.status === 'closed' ? 'ghost' : 'outline'"
                :disabled="busy === c.category"
                @click="openBallots([c.category], c.category)"
              >
                {{ c.status === 'closed' ? t('voting.reopen') : t('voting.open') }}
              </Button>
            </template>
          </div>
        </div>

        <MeetingVotingCategory
          :category="c"
          :can-manage="canManage"
          :members="props.members"
          :guests="props.guests"
          :busy="busy"
          @vote="(sid, cid) => vote(sid, cid, `${c.category}:${cid}`)"
          @add="(sid, target) => addCandidate(sid, c.category, target)"
          @exclude="(cid, ex) => toggleExclude(cid, ex, `${c.category}:${cid}`)"
          @remove="cid => removeCandidate(cid, `${c.category}:${cid}`)"
        />
      </div>

      <!-- Table Topics — both ballots opened / closed together -->
      <div class="rounded-lg border border-border p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-medium">
            {{ t('voting.tableTopicsGroup') }}
          </div>
          <div class="flex items-center gap-2">
            <span
              v-if="tableTopicsStatus"
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="tableTopicsStatus === 'open'
                ? 'bg-secondary/15 text-secondary'
                : 'bg-muted text-muted-foreground'"
            >
              {{ statusLabel(tableTopicsStatus) }}
            </span>

            <template v-if="canManage">
              <Button
                v-if="tableTopicsStatus === 'open'"
                size="sm"
                variant="ghost"
                :disabled="busy === 'table_topics'"
                @click="closeBallots(tableTopicsSessionIds, 'table_topics')"
              >
                {{ t('voting.closeBoth') }}
              </Button>
              <Button
                v-else
                size="sm"
                :variant="tableTopicsStatus === 'closed' ? 'ghost' : 'outline'"
                :disabled="busy === 'table_topics'"
                @click="openBallots(TABLE_TOPICS_CATEGORIES, 'table_topics')"
              >
                {{ tableTopicsStatus === 'closed' ? t('voting.reopenBoth') : t('voting.openBoth') }}
              </Button>
            </template>
          </div>
        </div>

        <p
          v-if="!canManage && !tableTopicsStatus"
          class="mt-2 text-sm text-muted-foreground/70"
        >
          {{ t('voting.notOpened') }}
        </p>
        <div
          v-else
          class="mt-3 grid gap-4 sm:grid-cols-2"
        >
          <div
            v-for="c in tableTopicsCategories"
            :key="c.category"
          >
            <div class="text-sm font-medium text-muted-foreground">
              {{ t(`voting.categories.${c.category}`) }}
            </div>
            <MeetingVotingCategory
              :category="c"
              :can-manage="canManage"
              :members="props.members"
              :guests="props.guests"
              :busy="busy"
              @vote="(sid, cid) => vote(sid, cid, `${c.category}:${cid}`)"
              @add="(sid, target) => addCandidate(sid, c.category, target)"
              @exclude="(cid, ex) => toggleExclude(cid, ex, `${c.category}:${cid}`)"
              @remove="cid => removeCandidate(cid, `${c.category}:${cid}`)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
