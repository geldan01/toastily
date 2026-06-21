<script setup lang="ts">
import { BarChart3, FileText, Mail, Pin, Plus, Route, Trash2, UserMinus, Wrench } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { user } = useUserSession()

type Position = { nameEn: string, nameFr: string }
type Member = {
  id: string
  name: string
  email: string | null
  status: 'member' | 'officer' | 'admin'
  since: string
  avatarUrl: string | null
  positions: Position[]
  bio: string | null
  goals: string | null
  phone: string | null
}
type Message = {
  id: string
  titleEn: string
  titleFr: string
  bodyEn: string
  bodyFr: string
  pinned: boolean
  expiresAt: string | null
  createdAt: string
  authorName: string | null
}

const { data, refresh: refreshRoster } = await useFetch<{ members: Member[] }>('/api/members/roster', {
  key: 'members-roster',
  default: () => ({ members: [] }),
})

const members = computed(() => data.value?.members ?? [])

// People-management capability gates the revoke action (issue #50): admin or a
// `canAssignOfficers` (President) position. Authority is data, not a role name.
const { data: caps } = useCapabilities()
const canManagePeople = computed(() => caps.value?.canAssignOfficers ?? false)
// Announcement authoring is gated on the communication capability (issue #63) —
// admin or a `canManageCommunication` executive position, never a role name.
const canManageMessages = computed(() => caps.value?.canManageCommunication ?? false)

// A member/officer (not self, not an admin) may be revoked back to guest.
function canRevoke(m: Member) {
  return canManagePeople.value && m.id !== user.value?.id && m.status !== 'admin'
}

const revoking = ref<string | null>(null)

async function revokeMember(m: Member) {
  if (!window.confirm(t('members.roster.confirmRevoke', { name: m.name }))) return
  revoking.value = m.id
  try {
    await $fetch(`/api/members/${m.id}/revoke`, { method: 'POST' })
    await refreshRoster()
  }
  finally {
    revoking.value = null
  }
}

const { data: messageData, refresh: refreshMessages } = await useFetch<{ messages: Message[] }>(
  '/api/messages',
  { key: 'members-messages', default: () => ({ messages: [] }) },
)
const messages = computed(() => messageData.value?.messages ?? [])

// Submitted meeting minutes (newest first), from the secretary feature.
type MinutesApprovalStatus = 'pending' | 'read' | 'amended'
type MinutesEntry = {
  meetingId: string
  date: string
  meetingNumber: number | null
  unfinishedBusiness: string | null
  newBusiness: string | null
  upcomingEvents: string | null
  specialReminders: string | null
  generalEvaluatorMention: string | null
  submitterName: string | null
  submittedAt: string | null
  approvalStatus: MinutesApprovalStatus
  approverName: string | null
  approvedAt: string | null
  amendmentNotes: string | null
}
const { data: minutesData } = await useFetch<{ minutes: MinutesEntry[] }>('/api/meetings/minutes', {
  key: 'members-minutes',
  default: () => ({ minutes: [] }),
})
const minutesList = computed(() => minutesData.value?.minutes ?? [])

const MINUTES_SECTIONS = [
  { key: 'unfinishedBusiness', label: 'meetings.minutesUnfinishedBusiness' },
  { key: 'newBusiness', label: 'meetings.minutesNewBusiness' },
  { key: 'upcomingEvents', label: 'meetings.minutesUpcomingEvents' },
  { key: 'specialReminders', label: 'meetings.minutesSpecialReminders' },
  { key: 'generalEvaluatorMention', label: 'meetings.minutesGeneralEvaluatorMention' },
] as const

const openMinutes = reactive<Record<string, boolean>>({})
function toggleMinutes(id: string) {
  openMinutes[id] = !openMinutes[id]
}
const minutesStatusLabel = (s: MinutesApprovalStatus) => t(
  s === 'read' ? 'meetings.minutesStatusRead' : s === 'amended' ? 'meetings.minutesStatusAmended' : 'meetings.minutesStatusPending',
)
const minutesStatusVariant = (s: MinutesApprovalStatus) => (s === 'pending' ? 'outline' : 'secondary')
const minutesStatusWord = (s: MinutesApprovalStatus) => t(s === 'amended' ? 'meetings.minutesStatusAmended' : 'meetings.minutesStatusRead')

// Compose form (hidden behind a button until opened). Announcements are
// bilingual user-generated content — both EN/FR title + body are required.
const composing = ref(false)
const composeTitleEn = ref('')
const composeTitleFr = ref('')
const composeBodyEn = ref('')
const composeBodyFr = ref('')
const composePinned = ref(false)
const composeExpiresAt = ref('')
const composeSendEmail = ref(false)
const posting = ref(false)
const composeError = ref('')

const canPost = computed(() =>
  composeTitleEn.value.trim().length > 0
  && composeTitleFr.value.trim().length > 0
  && composeBodyEn.value.trim().length > 0
  && composeBodyFr.value.trim().length > 0
  && !posting.value)

function openCompose() {
  composeError.value = ''
  composing.value = true
}

function cancelCompose() {
  composing.value = false
  composeTitleEn.value = ''
  composeTitleFr.value = ''
  composeBodyEn.value = ''
  composeBodyFr.value = ''
  composePinned.value = false
  composeExpiresAt.value = ''
  composeSendEmail.value = false
  composeError.value = ''
}

async function postMessage() {
  if (!canPost.value) return
  posting.value = true
  composeError.value = ''
  try {
    await $fetch('/api/messages', {
      method: 'POST',
      body: {
        titleEn: composeTitleEn.value.trim(),
        titleFr: composeTitleFr.value.trim(),
        bodyEn: composeBodyEn.value.trim(),
        bodyFr: composeBodyFr.value.trim(),
        pinned: composePinned.value,
        expiresAt: composeExpiresAt.value || null,
        sendEmail: composeSendEmail.value,
      },
    })
    await refreshMessages()
    cancelCompose()
  }
  catch (e) {
    composeError.value = errorMessage(e, t('members.messages.error'))
  }
  finally {
    posting.value = false
  }
}

// Render the announcement in the viewer's locale.
const msgTitle = (m: Message) => (locale.value === 'fr' ? m.titleFr : m.titleEn)
const msgBody = (m: Message) => (locale.value === 'fr' ? m.bodyFr : m.bodyEn)

async function deleteMessage(id: string) {
  if (!window.confirm(t('members.messages.confirmDelete'))) return
  await $fetch(`/api/messages/${id}`, { method: 'DELETE' })
  await refreshMessages()
}

const statusLabel = (s: Member['status']) => t(`account.status${s.charAt(0).toUpperCase()}${s.slice(1)}`)
const positionLabel = (p: Position) => (locale.value === 'fr' ? p.nameFr : p.nameEn)

function fmt(date: string) {
  return new Date(date).toLocaleDateString(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long',
  })
}

function fmtDateTime(date: string) {
  return new Date(date).toLocaleDateString(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// Meeting date is a YYYY-MM-DD string — anchor to local midnight to avoid TZ drift.
function fmtMeetingDate(date: string) {
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

useHead(() => ({ title: t('members.title') }))
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12">
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('members.title') }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('members.subtitle') }}
      </p>
    </header>

    <!-- Announcements (PRD §7.1, issues #17/#63) — always the top, highlighted block -->
    <section class="mb-10 rounded-xl border-2 border-primary/40 bg-primary/5 p-5 shadow-sm sm:p-6">
      <h2 class="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight text-primary">
        <Mail class="size-5" /> {{ t('members.messages.title') }}
      </h2>

      <!-- Communication manager: button to reveal the compose form -->
      <div
        v-if="canManageMessages && !composing"
        class="mb-4"
      >
        <Button
          variant="outline"
          @click="openCompose"
        >
          <Plus class="size-4" /> {{ t('members.messages.addButton') }}
        </Button>
      </div>

      <!-- Compose form (bilingual) -->
      <Card
        v-if="canManageMessages && composing"
        class="mb-4"
      >
        <CardHeader>
          <CardTitle class="text-base">
            {{ t('members.messages.compose') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-3">
              <p class="text-sm font-semibold text-muted-foreground">
                {{ t('members.messages.langEn') }}
              </p>
              <Input
                v-model="composeTitleEn"
                :placeholder="t('members.messages.titlePlaceholder')"
              />
              <textarea
                v-model="composeBodyEn"
                :placeholder="t('members.messages.placeholder')"
                rows="3"
                class="placeholder:text-muted-foreground dark:bg-input/30 border-input min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              />
            </div>
            <div class="space-y-3">
              <p class="text-sm font-semibold text-muted-foreground">
                {{ t('members.messages.langFr') }}
              </p>
              <Input
                v-model="composeTitleFr"
                :placeholder="t('members.messages.titlePlaceholder')"
              />
              <textarea
                v-model="composeBodyFr"
                :placeholder="t('members.messages.placeholder')"
                rows="3"
                class="placeholder:text-muted-foreground dark:bg-input/30 border-input min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              />
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="composePinned"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
              >
              {{ t('members.messages.pin') }}
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="composeSendEmail"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
              >
              {{ t('members.messages.sendEmail') }}
            </label>
            <label class="flex items-center gap-2 text-sm">
              <span class="text-muted-foreground">{{ t('members.messages.expires') }}</span>
              <Input
                v-model="composeExpiresAt"
                type="date"
                class="h-8 w-auto"
              />
            </label>
          </div>
          <p
            v-if="composeError"
            class="text-sm text-destructive"
          >
            {{ composeError }}
          </p>
          <div class="flex justify-end gap-2">
            <Button
              variant="ghost"
              :disabled="posting"
              @click="cancelCompose"
            >
              {{ t('common.cancel') }}
            </Button>
            <Button
              :disabled="!canPost"
              @click="postMessage"
            >
              {{ posting ? t('members.messages.posting') : t('members.messages.post') }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Empty state -->
      <Card
        v-if="!messages.length"
        class="opacity-70"
      >
        <CardHeader>
          <CardDescription>{{ t('members.messages.empty') }}</CardDescription>
        </CardHeader>
      </Card>

      <!-- Message list -->
      <ul
        v-else
        class="space-y-3"
      >
        <li
          v-for="msg in messages"
          :key="msg.id"
        >
          <Card :class="msg.pinned ? 'border-primary/50' : ''">
            <CardHeader class="flex-row items-start justify-between gap-4 space-y-0">
              <div class="min-w-0">
                <CardTitle class="text-base">
                  {{ msgTitle(msg) }}
                </CardTitle>
                <p class="mt-1 whitespace-pre-wrap break-words text-sm">
                  {{ msgBody(msg) }}
                </p>
                <CardDescription class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge
                    v-if="msg.pinned"
                    variant="secondary"
                    class="gap-1"
                  >
                    <Pin class="size-3" /> {{ t('members.messages.pinned') }}
                  </Badge>
                  <span>{{ msg.authorName ?? '—' }}</span>
                  <span>· {{ fmtDateTime(msg.createdAt) }}</span>
                  <span v-if="msg.expiresAt">· {{ t('members.messages.expiresOn', { date: fmtDateTime(msg.expiresAt) }) }}</span>
                </CardDescription>
              </div>
              <Button
                v-if="canManageMessages"
                variant="ghost"
                size="icon"
                :aria-label="t('members.messages.delete')"
                @click="deleteMessage(msg.id)"
              >
                <Trash2 class="size-4" />
              </Button>
            </CardHeader>
          </Card>
        </li>
      </ul>
    </section>

    <!-- Member hub (PRD §7.1) -->
    <div class="mb-10 grid gap-4 sm:grid-cols-2">
      <NuxtLink :to="localePath('/participation')">
        <Card class="h-full transition-colors hover:border-primary/50 hover:bg-muted/40">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-base">
              <BarChart3 class="size-4" /> {{ t('participation.title') }}
            </CardTitle>
            <CardDescription>{{ t('participation.cardHint') }}</CardDescription>
          </CardHeader>
        </Card>
      </NuxtLink>
      <NuxtLink :to="localePath('/pathways')">
        <Card class="h-full transition-colors hover:border-primary/50 hover:bg-muted/40">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-base">
              <Route class="size-4" /> {{ t('pathways.title') }}
            </CardTitle>
            <CardDescription>{{ t('pathways.cardHint') }}</CardDescription>
          </CardHeader>
        </Card>
      </NuxtLink>
      <Card class="opacity-70">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <Wrench class="size-4" /> {{ t('members.tools.title') }}
          </CardTitle>
          <CardDescription>{{ t('members.tools.soon') }}</CardDescription>
        </CardHeader>
      </Card>
    </div>

    <!-- Meeting minutes (secretary feature, issue #14) -->
    <section class="mb-10">
      <h2 class="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
        <FileText class="size-5" /> {{ t('meetings.minutesTitle') }}
      </h2>

      <Card
        v-if="!minutesList.length"
        class="opacity-70"
      >
        <CardHeader>
          <CardDescription>{{ t('meetings.minutesNone') }}</CardDescription>
        </CardHeader>
      </Card>

      <ul
        v-else
        class="space-y-3"
      >
        <li
          v-for="m in minutesList"
          :key="m.meetingId"
        >
          <Card>
            <CardHeader class="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <CardTitle class="text-base">
                <template v-if="m.meetingNumber != null">
                  {{ t('meetings.meetingNo', { n: m.meetingNumber }) }} ·
                </template>{{ fmtMeetingDate(m.date) }}
              </CardTitle>
              <Badge :variant="minutesStatusVariant(m.approvalStatus)">
                {{ minutesStatusLabel(m.approvalStatus) }}
              </Badge>
            </CardHeader>
            <CardContent class="space-y-3">
              <Button
                variant="outline"
                size="sm"
                @click="toggleMinutes(m.meetingId)"
              >
                {{ openMinutes[m.meetingId] ? t('meetings.minutesHide') : t('meetings.minutesView') }}
              </Button>

              <template v-if="openMinutes[m.meetingId]">
                <dl class="space-y-4 border-t border-border pt-3">
                  <div
                    v-for="s in MINUTES_SECTIONS"
                    :key="s.key"
                  >
                    <dt class="text-sm font-semibold text-secondary">
                      {{ t(s.label) }}
                    </dt>
                    <dd class="mt-1 whitespace-pre-line text-sm">
                      {{ m[s.key] || '—' }}
                    </dd>
                  </div>
                </dl>
                <footer class="border-t border-border pt-3 text-xs text-muted-foreground">
                  <p v-if="m.submittedAt">
                    {{ t('meetings.minutesSubmittedBy', { name: m.submitterName ?? '—', date: fmtDateTime(m.submittedAt) }) }}
                  </p>
                  <p
                    v-if="m.approvalStatus !== 'pending' && m.approvedAt"
                    class="mt-1"
                  >
                    {{ t('meetings.minutesApprovedBy', { status: minutesStatusWord(m.approvalStatus), name: m.approverName ?? '—', date: fmtDateTime(m.approvedAt) }) }}
                  </p>
                  <p
                    v-if="m.amendmentNotes"
                    class="mt-2 whitespace-pre-line"
                  >
                    <span class="font-medium">{{ t('meetings.minutesAmendmentNotes') }}:</span>
                    {{ m.amendmentNotes }}
                  </p>
                </footer>
              </template>
            </CardContent>
          </Card>
        </li>
      </ul>
    </section>

    <!-- Roster (PRD §7.1) -->
    <section>
      <h2 class="mb-4 text-xl font-semibold tracking-tight">
        {{ t('members.roster.title') }}
        <span class="text-base font-normal text-muted-foreground">({{ members.length }})</span>
      </h2>

      <ul class="space-y-3">
        <li
          v-for="m in members"
          :key="m.id"
        >
          <Card>
            <CardHeader class="flex-row items-start justify-between gap-4 space-y-0">
              <div class="flex min-w-0 items-start gap-3">
                <MemberAvatar
                  :name="m.name"
                  :src="m.avatarUrl"
                  :size="40"
                  class="mt-0.5"
                />
                <div class="min-w-0">
                  <CardTitle class="text-base">
                    <NuxtLink
                      :to="localePath(`/participation/${m.id}`)"
                      class="hover:underline"
                    >
                      {{ m.name }}
                    </NuxtLink>
                  </CardTitle>
                  <CardDescription class="truncate">
                    <a
                      v-if="m.email"
                      :href="`mailto:${m.email}`"
                      class="hover:underline"
                    >{{ m.email }}</a>
                    <span
                      v-else
                      class="italic"
                    >{{ t('members.roster.contactHidden') }}</span>
                    · {{ t('members.roster.since', { date: fmt(m.since) }) }}
                  </CardDescription>
                  <p
                    v-if="m.phone"
                    class="text-sm text-muted-foreground"
                  >
                    <a
                      :href="`tel:${m.phone}`"
                      class="hover:underline"
                    >{{ m.phone }}</a>
                  </p>
                  <p
                    v-if="m.bio"
                    class="mt-2 text-sm"
                  >
                    {{ m.bio }}
                  </p>
                  <p
                    v-if="m.goals"
                    class="mt-1 text-sm text-muted-foreground"
                  >
                    <span class="font-medium">{{ t('members.roster.goals') }}:</span> {{ m.goals }}
                  </p>
                  <div
                    v-if="m.positions.length"
                    class="mt-2 flex flex-wrap gap-1.5"
                  >
                    <Badge
                      v-for="p in m.positions"
                      :key="p.nameEn"
                      variant="secondary"
                    >
                      {{ positionLabel(p) }}
                    </Badge>
                  </div>
                </div>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-2">
                <Badge :variant="m.status === 'member' ? 'outline' : 'default'">
                  {{ statusLabel(m.status) }}
                </Badge>
                <Button
                  v-if="canRevoke(m)"
                  variant="ghost"
                  size="sm"
                  class="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  :disabled="revoking === m.id"
                  @click="revokeMember(m)"
                >
                  <UserMinus class="size-3.5" /> {{ t('members.roster.revoke') }}
                </Button>
              </div>
            </CardHeader>
          </Card>
        </li>
      </ul>
    </section>
  </div>
</template>
