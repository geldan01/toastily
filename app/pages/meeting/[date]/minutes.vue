<script setup lang="ts">
import { CalendarDays, Check, ChevronDown, FileText, NotebookPen, Users } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

type ApprovalStatus = 'pending' | 'read' | 'amended'
interface MinutesRecord {
  id: string
  unfinishedBusiness: string | null
  newBusiness: string | null
  upcomingEvents: string | null
  specialReminders: string | null
  generalEvaluatorMention: string | null
  submittedBy: string | null
  submitterName: string | null
  submittedAt: string | null
  approvalStatus: ApprovalStatus
  approvedBy: string | null
  approverName: string | null
  approvedAt: string | null
  amendmentNotes: string | null
}
interface PreviousEntry {
  meetingId: string
  date: string
  meetingNumber: number | null
  minutes: MinutesRecord | null
}
interface QuorumData {
  members: number
  guests: number
  total: number
  threshold: number | null
  history: Array<{ date: string, meetingNumber: number | null, membersPresent: number }>
  met: boolean
}
interface MinutesData {
  meetingId: string | null
  date: string
  meetingNumber: number | null
  canManage: boolean
  quorum: QuorumData
  minutes: MinutesRecord | null
  previous: PreviousEntry[]
}

const EMPTY_QUORUM: QuorumData = {
  members: 0,
  guests: 0,
  total: 0,
  threshold: null,
  history: [],
  met: false,
}

const route = useRoute()
const date = computed(() => String(route.params.date))
const { locale, t } = useI18n()
const localePath = useLocalePath()

const { data, refresh } = await useFetch<MinutesData>(() => `/api/meetings/${date.value}/minutes`, {
  key: () => `minutes-${date.value}`,
})

const canManage = computed(() => data.value?.canManage ?? false)
const meetingId = computed(() => data.value?.meetingId ?? null)
const quorum = computed(() => data.value?.quorum ?? EMPTY_QUORUM)
const minutes = computed(() => data.value?.minutes ?? null)
const previous = computed(() => data.value?.previous ?? [])
const previousOpen = ref(false)
const meetingNumber = computed(() => data.value?.meetingNumber ?? null)

// Check-in roster (lifted from the attendance page) — managers record presence here.
interface PresentMember { id: string, userId: string, name: string, source: 'self' | 'secretary' }
interface AttendanceData {
  meetingId: string | null
  present: PresentMember[]
  count: { members: number, guests: number, total: number }
  selfPresent: boolean
  canManage: boolean
}
const { data: attendance, refresh: refreshAttendance } = await useFetch<AttendanceData>(
  () => `/api/meetings/${date.value}/attendance`,
  { key: () => `minutes-attendance-${date.value}` },
)
const present = computed(() => attendance.value?.present ?? [])
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

// Collapsed by default — with ~28 members the full roster is tall; the header
// keeps a present-count summary visible while it's closed.
const rosterOpen = ref(false)
const attendanceBusy = ref('')

// Toggling presence refreshes BOTH attendance (roster pre-fill) and the minutes
// detail, so the quorum readout's member count + met status update live.
async function setPresent(userId: string, presentNow: boolean) {
  if (!meetingId.value) return
  attendanceBusy.value = userId
  error.value = ''
  try {
    await $fetch('/api/meetings/attendance', {
      method: presentNow ? 'POST' : 'DELETE',
      body: { meetingId: meetingId.value, userId },
    })
    await Promise.all([refreshAttendance(), refresh()])
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { attendanceBusy.value = '' }
}

// Five sections, in display order, mapped to record fields + i18n labels.
const SECTIONS = [
  { key: 'unfinishedBusiness', label: 'meetings.minutesUnfinishedBusiness' },
  { key: 'newBusiness', label: 'meetings.minutesNewBusiness' },
  { key: 'upcomingEvents', label: 'meetings.minutesUpcomingEvents' },
  { key: 'specialReminders', label: 'meetings.minutesSpecialReminders' },
  { key: 'generalEvaluatorMention', label: 'meetings.minutesGeneralEvaluatorMention' },
] as const
type FieldKey = typeof SECTIONS[number]['key']

// This meeting's editable form.
const form = reactive<Record<FieldKey, string>>({
  unfinishedBusiness: '',
  newBusiness: '',
  upcomingEvents: '',
  specialReminders: '',
  generalEvaluatorMention: '',
})
watchEffect(() => {
  const m = minutes.value
  for (const { key } of SECTIONS) form[key] = (m?.[key] ?? '')
})

const submitting = ref(false)
const error = ref('')

async function submitMinutes() {
  if (!meetingId.value) return
  submitting.value = true
  error.value = ''
  try {
    await $fetch('/api/meetings/minutes', {
      method: 'PUT',
      body: {
        meetingId: meetingId.value,
        unfinishedBusiness: form.unfinishedBusiness.trim() || null,
        newBusiness: form.newBusiness.trim() || null,
        upcomingEvents: form.upcomingEvents.trim() || null,
        specialReminders: form.specialReminders.trim() || null,
        generalEvaluatorMention: form.generalEvaluatorMention.trim() || null,
      },
    })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { submitting.value = false }
}

// Quorum is a read-only calculated readout (no editable count, no confirm button).
const quorumThreshold = computed(() => quorum.value.threshold)
const historyFigures = computed(() => quorum.value.history.map(h => h.membersPresent).join(', '))

// Approval of a pending meeting's minutes.
const expanded = reactive<Record<string, boolean>>({})
const amending = reactive<Record<string, boolean>>({})
const amendNotes = reactive<Record<string, string>>({})
const approvingId = ref('')

function toggleView(id: string) {
  expanded[id] = !expanded[id]
}

async function approve(entry: PreviousEntry, status: 'read' | 'amended') {
  approvingId.value = entry.meetingId
  error.value = ''
  try {
    await $fetch('/api/meetings/minutes', {
      method: 'PATCH',
      body: {
        meetingId: entry.meetingId,
        status,
        amendmentNotes: status === 'amended' ? (amendNotes[entry.meetingId]?.trim() || null) : undefined,
      },
    })
    amending[entry.meetingId] = false
    amendNotes[entry.meetingId] = ''
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { approvingId.value = '' }
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(`${iso}T00:00:00`))
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(iso))
}

const statusLabel = (s: ApprovalStatus) => t(
  s === 'read' ? 'meetings.minutesStatusRead' : s === 'amended' ? 'meetings.minutesStatusAmended' : 'meetings.minutesStatusPending',
)
const statusVariant = (s: ApprovalStatus) => (s === 'pending' ? 'outline' : 'secondary')
// The bare word used inside the "Approved as {status} by …" attestation.
const statusWord = (s: ApprovalStatus) => t(s === 'amended' ? 'meetings.minutesStatusAmended' : 'meetings.minutesStatusRead')

const prettyDate = computed(() => fmtDate(date.value))

useHead(() => ({ title: t('meetings.minutesTitle') }))
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
      <template v-if="meetingNumber != null">
        · {{ t('meetings.meetingNo', { n: meetingNumber }) }}
      </template>
    </div>

    <h1 class="mt-2 flex items-center gap-2 text-3xl font-bold tracking-tight">
      <NotebookPen class="size-7" />
      {{ t('meetings.minutesTitle') }}
    </h1>

    <div
      v-if="error"
      class="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {{ error }}
    </div>

    <!-- READ-ONLY view for plain members -->
    <template v-if="!canManage">
      <p class="mt-4 text-sm text-muted-foreground">
        {{ t('meetings.minutesReadOnly') }}
      </p>

      <template v-if="minutes">
        <dl class="mt-6 space-y-5">
          <div
            v-for="s in SECTIONS"
            :key="s.key"
          >
            <dt class="text-sm font-semibold text-secondary">
              {{ t(s.label) }}
            </dt>
            <dd class="mt-1 whitespace-pre-line text-sm">
              {{ minutes[s.key] || '—' }}
            </dd>
          </div>
        </dl>

        <footer class="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
          <p v-if="minutes.submittedAt">
            {{ t('meetings.minutesSubmittedBy', { name: minutes.submitterName ?? '—', date: fmtDateTime(minutes.submittedAt) }) }}
          </p>
          <p
            v-if="minutes.approvalStatus !== 'pending' && minutes.approvedAt"
            class="mt-1"
          >
            {{ t('meetings.minutesApprovedBy', { status: statusWord(minutes.approvalStatus), name: minutes.approverName ?? '—', date: fmtDateTime(minutes.approvedAt) }) }}
          </p>
          <p
            v-if="minutes.amendmentNotes"
            class="mt-2 whitespace-pre-line"
          >
            <span class="font-medium">{{ t('meetings.minutesAmendmentNotes') }}:</span>
            {{ minutes.amendmentNotes }}
          </p>
        </footer>
      </template>

      <p
        v-else
        class="mt-6 rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground"
      >
        {{ t('meetings.minutesNone') }}
      </p>
    </template>

    <!-- MANAGER (secretary) view -->
    <template v-else>
      <!-- 1. Quorum readout (calculated, read-only) -->
      <Card class="mt-6">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-lg">
            {{ t('meetings.minutesQuorum') }}
            <Badge
              v-if="quorumThreshold != null"
              :variant="quorum.met ? 'secondary' : 'destructive'"
            >
              {{ quorum.met ? t('meetings.quorumMet') : t('meetings.quorumNotMet') }}
            </Badge>
          </CardTitle>
          <CardDescription>
            <template v-if="quorumThreshold != null">
              {{ t('meetings.quorumRequired', { threshold: quorumThreshold }) }}
              <span
                v-if="quorum.history.length"
                class="mt-0.5 block text-xs"
              >
                {{ t('meetings.quorumBasedOn', { figures: historyFigures }) }}
              </span>
            </template>
            <template v-else>
              {{ t('meetings.quorumNoData') }}
            </template>
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <p
            class="text-base font-semibold tabular-nums"
            :class="quorumThreshold == null
              ? 'text-foreground'
              : quorum.met ? 'text-green-600 dark:text-green-500' : 'text-destructive'"
          >
            {{ t('meetings.quorumMembersPresentLabel', { n: quorum.members }) }}
          </p>
          <div class="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>{{ t('meetings.quorumGuests', { n: quorum.guests }) }}</span>
            <span>{{ t('meetings.quorumTotalPresent', { n: quorum.total }) }}</span>
          </div>
        </CardContent>
      </Card>

      <!-- 2. Member check-in roster (collapsible; presence may be recorded anytime) -->
      <section class="mt-8">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-left font-semibold transition-colors hover:bg-muted/70"
          :aria-expanded="rosterOpen"
          @click="rosterOpen = !rosterOpen"
        >
          <Users class="size-5 shrink-0" />
          <span>{{ t('meetings.recordAttendance') }}</span>
          <span class="text-sm font-normal text-muted-foreground">({{ t('meetings.presentCount', { n: present.length }) }})</span>
          <ChevronDown
            class="ml-auto size-5 shrink-0 transition-transform"
            :class="rosterOpen ? 'rotate-180' : ''"
          />
        </button>

        <div v-show="rosterOpen">
          <p class="mt-2 text-sm text-muted-foreground">
            {{ t('meetings.recordAttendanceHint') }}
          </p>
          <p class="mb-3 text-xs text-muted-foreground">
            {{ t('meetings.recordAttendanceAnytime') }}
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
                :disabled="attendanceBusy === m.id"
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
        </div>
      </section>

      <!-- 3. Minutes awaiting approval -->
      <section class="mt-8">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-left font-semibold transition-colors hover:bg-muted/70"
          :aria-expanded="previousOpen"
          @click="previousOpen = !previousOpen"
        >
          <FileText class="size-5 shrink-0" />
          <span>{{ t('meetings.minutesPrevious') }}</span>
          <ChevronDown
            class="ml-auto size-5 shrink-0 transition-transform"
            :class="previousOpen ? 'rotate-180' : ''"
          />
        </button>

        <div
          v-show="previousOpen"
          class="mt-3"
        >
          <ul
            v-if="previous.length"
            class="space-y-3"
          >
            <li
              v-for="entry in previous"
              :key="entry.meetingId"
            >
              <Card>
                <CardHeader class="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle class="text-base">
                      <template v-if="entry.meetingNumber != null">
                        {{ t('meetings.meetingNo', { n: entry.meetingNumber }) }} ·
                      </template>{{ fmtDate(entry.date) }}
                    </CardTitle>
                  </div>
                  <Badge :variant="entry.minutes ? statusVariant(entry.minutes.approvalStatus) : 'outline'">
                    {{ entry.minutes ? statusLabel(entry.minutes.approvalStatus) : t('meetings.minutesNotSubmitted') }}
                  </Badge>
                </CardHeader>

                <!-- Submitted minutes: read + approve/amend -->
                <CardContent
                  v-if="entry.minutes"
                  class="space-y-3"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    @click="toggleView(entry.meetingId)"
                  >
                    {{ expanded[entry.meetingId] ? t('meetings.minutesHide') : t('meetings.minutesView') }}
                  </Button>

                  <dl
                    v-if="expanded[entry.meetingId]"
                    class="space-y-4 border-t border-border pt-3"
                  >
                    <div
                      v-for="s in SECTIONS"
                      :key="s.key"
                    >
                      <dt class="text-sm font-semibold text-secondary">
                        {{ t(s.label) }}
                      </dt>
                      <dd class="mt-1 whitespace-pre-line text-sm">
                        {{ entry.minutes?.[s.key] || '—' }}
                      </dd>
                    </div>
                  </dl>

                  <!-- Amendment notes input -->
                  <div
                    v-if="amending[entry.meetingId]"
                    class="space-y-1.5"
                  >
                    <Label :for="`amend-${entry.meetingId}`">{{ t('meetings.minutesAmendmentNotes') }}</Label>
                    <textarea
                      :id="`amend-${entry.meetingId}`"
                      v-model="amendNotes[entry.meetingId]"
                      rows="3"
                      class="placeholder:text-muted-foreground dark:bg-input/30 border-input min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    />
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      :disabled="approvingId === entry.meetingId"
                      @click="approve(entry, 'read')"
                    >
                      <Check class="size-4" /> {{ t('meetings.minutesApproveRead') }}
                    </Button>
                    <Button
                      v-if="!amending[entry.meetingId]"
                      variant="outline"
                      size="sm"
                      :disabled="approvingId === entry.meetingId"
                      @click="amending[entry.meetingId] = true"
                    >
                      {{ t('meetings.minutesApproveAmended') }}
                    </Button>
                    <Button
                      v-else
                      variant="secondary"
                      size="sm"
                      :disabled="approvingId === entry.meetingId"
                      @click="approve(entry, 'amended')"
                    >
                      <Check class="size-4" /> {{ t('meetings.minutesApproveAmended') }}
                    </Button>
                  </div>
                </CardContent>

                <!-- No minutes entered for this past meeting yet -->
                <CardContent v-else>
                  <p class="text-sm text-muted-foreground">
                    {{ t('meetings.minutesNotSubmittedHint') }}
                  </p>
                </CardContent>
              </Card>
            </li>
          </ul>
          <p
            v-else
            class="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground"
          >
            {{ t('meetings.minutesNoPrevious') }}
          </p>
        </div>
      </section>

      <!-- 3. This meeting's minutes form -->
      <section
        v-if="meetingId"
        class="mt-8"
      >
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold">
          <NotebookPen class="size-5" /> {{ t('meetings.minutesFormTitle') }}
        </h2>

        <p
          v-if="minutes?.submittedAt"
          class="mb-4 text-xs text-muted-foreground"
        >
          {{ t('meetings.minutesLastSubmitted', { name: minutes.submitterName ?? '—', date: fmtDateTime(minutes.submittedAt) }) }}
        </p>

        <div class="space-y-4">
          <div
            v-for="s in SECTIONS"
            :key="s.key"
            class="space-y-1.5"
          >
            <Label :for="`field-${s.key}`">{{ t(s.label) }}</Label>
            <textarea
              :id="`field-${s.key}`"
              v-model="form[s.key]"
              rows="3"
              class="placeholder:text-muted-foreground dark:bg-input/30 border-input min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            />
          </div>
        </div>

        <div class="mt-4">
          <Button
            :disabled="submitting"
            @click="submitMinutes"
          >
            {{ submitting ? t('meetings.minutesSubmitting') : t('meetings.minutesSubmit') }}
          </Button>
        </div>
      </section>
    </template>
  </div>
</template>
