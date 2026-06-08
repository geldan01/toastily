<script setup lang="ts">
import { CalendarDays, FileText, MapPin, UserPlus, X } from '@lucide/vue'

interface Occupant { userId: string | null, name: string | null, isGuest: boolean }
interface RoleRow { roleId: string, nameEn: string, nameFr: string, occupant: Occupant | null }
type SpeechField = 'speaker' | 'evaluator'
interface SpeechSlot {
  slot: number
  title: string | null
  minMinutes: number
  maxMinutes: number
  speaker: Occupant | null
  evaluator: Occupant | null
}
interface MeetingDetail {
  meeting: { id: string, date: string, meetingNumber: number | null, status: 'scheduled' | 'cancelled', themeEn: string | null, themeFr: string | null, location: string | null, notesEn: string | null, notesFr: string | null, templateId: string | null } | null
  holiday: { labelEn: string, labelFr: string } | null
  roles: RoleRow[]
  speeches: SpeechSlot[]
}

const route = useRoute()
const date = computed(() => String(route.params.date))
const { locale, t } = useI18n()
const localePath = useLocalePath()
const { loggedIn, user } = useUserSession()

const isMember = computed(() => hasMinRole(user.value?.status, 'member'))

const { data, refresh } = await useFetch<MeetingDetail>(() => `/api/meetings/${date.value}`, {
  key: () => `meeting-${date.value}`,
})

// Whether the viewer may assign/reassign/release any signup for this meeting
// (officer/admin OR the meeting's authority-role holder, e.g. the Toastmaster).
const canManage = computed(() => data.value?.canManageSignups ?? false)

// Member roster for the assign dropdown — only loaded once the viewer turns out
// to be a meeting manager (the endpoint requires a logged-in member).
interface Member { id: string, name: string }
const { data: memberData, execute: loadMembers } = await useFetch<{ members: Member[] }>('/api/meetings/members', {
  key: 'meeting-members',
  immediate: false,
})
watch(canManage, (v) => {
  if (v && !memberData.value) loadMembers()
}, { immediate: true })
const members = computed(() => memberData.value?.members ?? [])

const meeting = computed(() => data.value?.meeting ?? null)
const theme = computed(() => meeting.value ? localized(meeting.value, 'theme', locale.value) : '')
const notes = computed(() => meeting.value ? localized(meeting.value, 'notes', locale.value) : '')
const roleName = (r: RoleRow) => locale.value === 'fr' ? r.nameFr : r.nameEn

const prettyDate = computed(() => {
  const d = new Date(`${date.value}T00:00:00`)
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(d)
})

const busy = ref('')
const error = ref('')

// Which assign panel is open (key = roleId or speechKey). One at a time. The
// panel itself (MeetingAssignPanel) owns the member/guest choice and emits the
// resolved POST-body fragment on submit.
type AssignTarget = { userId: string } | { guestName: string }
const assignFor = ref<string | null>(null)
function toggleAssign(key: string) {
  assignFor.value = assignFor.value === key ? null : key
}

async function claim(roleId: string) {
  busy.value = roleId
  error.value = ''
  try {
    await $fetch('/api/meetings/signup', { method: 'POST', body: { meetingId: meeting.value!.id, roleId } })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = '' }
}

async function assignRole(roleId: string, target: AssignTarget) {
  busy.value = roleId
  error.value = ''
  try {
    await $fetch('/api/meetings/signup', { method: 'POST', body: { meetingId: meeting.value!.id, roleId, ...target } })
    assignFor.value = null
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = '' }
}

async function release(roleId: string) {
  busy.value = roleId
  error.value = ''
  try {
    await $fetch('/api/meetings/signup', { method: 'DELETE', body: { meetingId: meeting.value!.id, roleId } })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = '' }
}

// A member may release the role they personally hold; meeting managers any.
function canRelease(r: RoleRow) {
  if (!r.occupant) return false
  if (canManage.value) return true
  return r.occupant.userId && r.occupant.userId === user.value?.id
}

// --- Speeches -------------------------------------------------------------
// A speech slot has two participant fields (speaker, evaluator), each claimed
// or assigned exactly like a meeting role, plus an editable title.
const speechFields: SpeechField[] = ['speaker', 'evaluator']
const occupantOf = (s: SpeechSlot, f: SpeechField) => f === 'speaker' ? s.speaker : s.evaluator
const speechKey = (slot: number, f: SpeechField) => `speech-${slot}-${f}`
const fieldLabel = (f: SpeechField) => f === 'speaker' ? t('meetings.speaker') : t('meetings.evaluator')

// Local title edit buffer per slot (so the Save button only shows when changed).
const titleEdits = reactive<Record<number, string>>({})
watchEffect(() => {
  for (const s of data.value?.speeches ?? []) {
    if (!(s.slot in titleEdits)) titleEdits[s.slot] = s.title ?? ''
  }
})
const titleDirty = (s: SpeechSlot) => (titleEdits[s.slot] ?? '') !== (s.title ?? '')

// Per-slot timing window edit buffer (min/max minutes).
const timeEdits = reactive<Record<number, { min: number, max: number }>>({})
watchEffect(() => {
  for (const s of data.value?.speeches ?? []) {
    if (!(s.slot in timeEdits)) timeEdits[s.slot] = { min: s.minMinutes, max: s.maxMinutes }
  }
})
function timeDirty(s: SpeechSlot) {
  const e = timeEdits[s.slot]
  return !!e && (e.min !== s.minMinutes || e.max !== s.maxMinutes)
}
function timeValid(s: SpeechSlot) {
  const e = timeEdits[s.slot]
  return !!e && Number.isInteger(e.min) && Number.isInteger(e.max) && e.min >= 1 && e.max >= e.min
}

async function saveTime(slot: number) {
  const e = timeEdits[slot]
  if (!e) return
  error.value = ''
  try {
    await $fetch('/api/meetings/speech', { method: 'PATCH', body: { meetingId: meeting.value!.id, slot, minMinutes: e.min, maxMinutes: e.max } })
    await refresh()
  }
  catch (err) { error.value = errorMessage(err, t('auth.genericError')) }
}

function canReleaseSlot(s: SpeechSlot, f: SpeechField) {
  const occ = occupantOf(s, f)
  if (!occ) return false
  if (canManage.value) return true
  return occ.userId && occ.userId === user.value?.id
}
// Title is editable by a meeting manager or by the slot's speaker.
function canEditTitle(s: SpeechSlot) {
  if (canManage.value) return true
  return !!s.speaker?.userId && s.speaker.userId === user.value?.id
}

async function claimSpeech(slot: number, field: SpeechField) {
  busy.value = speechKey(slot, field)
  error.value = ''
  try {
    await $fetch('/api/meetings/speech', { method: 'POST', body: { meetingId: meeting.value!.id, slot, field } })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = '' }
}

async function assignSpeech(slot: number, field: SpeechField, target: AssignTarget) {
  busy.value = speechKey(slot, field)
  error.value = ''
  try {
    await $fetch('/api/meetings/speech', { method: 'POST', body: { meetingId: meeting.value!.id, slot, field, ...target } })
    assignFor.value = null
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = '' }
}

async function releaseSpeech(slot: number, field: SpeechField) {
  busy.value = speechKey(slot, field)
  error.value = ''
  try {
    await $fetch('/api/meetings/speech', { method: 'DELETE', body: { meetingId: meeting.value!.id, slot, field } })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = '' }
}

async function saveTitle(slot: number, title: string) {
  error.value = ''
  try {
    await $fetch('/api/meetings/speech', { method: 'PATCH', body: { meetingId: meeting.value!.id, slot, title } })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
}

useHead(() => ({ title: theme.value || prettyDate.value }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <NuxtLink
      :to="localePath('/meetings')"
      class="text-sm text-muted-foreground hover:text-foreground"
    >
      ← {{ t('meetings.title') }}
    </NuxtLink>

    <div class="mt-3 flex items-center gap-2 text-sm font-medium text-secondary">
      <CalendarDays class="size-4" />
      {{ prettyDate }}
    </div>

    <!-- No meeting on this date -->
    <template v-if="!meeting">
      <h1 class="mt-2 text-3xl font-bold tracking-tight">
        {{ data?.holiday ? (locale === 'fr' ? data.holiday.labelFr : data.holiday.labelEn) : t('meetings.noMeeting') }}
      </h1>
      <p
        v-if="!data?.holiday"
        class="mt-3 text-muted-foreground"
      >
        {{ t('meetings.noMeetingBody') }}
      </p>
    </template>

    <template v-else>
      <div
        v-if="meeting.status === 'cancelled'"
        class="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive"
      >
        {{ t('meetings.cancelledBanner') }}
      </div>
      <div
        v-if="meeting.meetingNumber != null"
        class="mt-3 text-sm font-semibold text-secondary"
      >
        {{ t('meetings.meetingNo', { n: meeting.meetingNumber }) }}
      </div>
      <h1
        class="mt-1 text-3xl font-bold tracking-tight"
        :class="meeting.status === 'cancelled' ? 'text-muted-foreground line-through' : ''"
      >
        {{ theme || t('meetings.untitled') }}
      </h1>
      <p
        v-if="meeting.location"
        class="mt-2 flex items-center gap-2 text-muted-foreground"
      >
        <MapPin class="size-4" /> {{ meeting.location }}
      </p>
      <p
        v-if="notes"
        class="mt-3 whitespace-pre-line text-muted-foreground"
      >
        {{ notes }}
      </p>

      <div class="mt-4 flex flex-wrap gap-3">
        <Button
          as-child
          variant="secondary"
        >
          <NuxtLink :to="localePath(`/agenda?date=${meeting.date}`)">
            <FileText class="size-4" />
            {{ t('meetings.viewAgenda') }}
          </NuxtLink>
        </Button>
      </div>

      <div
        v-if="error"
        class="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
      >
        {{ error }}
      </div>

      <!-- Roles -->
      <h2 class="mt-8 text-xl font-semibold">
        {{ t('meetings.roles') }}
      </h2>
      <p
        v-if="!loggedIn"
        class="mt-1 text-sm text-muted-foreground"
      >
        {{ t('meetings.loginToSignUp') }}
      </p>

      <ul class="mt-3 divide-y divide-border rounded-lg border border-border">
        <li
          v-for="role in data!.roles"
          :key="role.roleId"
          class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div class="min-w-40">
            <div class="font-medium">
              {{ roleName(role) }}
            </div>
            <div
              v-if="role.occupant"
              class="text-sm text-muted-foreground"
            >
              {{ role.occupant.name }}
              <span
                v-if="role.occupant.isGuest"
                class="text-xs"
              >({{ t('meetings.guest') }})</span>
            </div>
            <div
              v-else
              class="text-sm text-muted-foreground/70"
            >
              {{ t('meetings.open') }}
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Open role: member self-signup -->
            <Button
              v-if="!role.occupant && isMember"
              size="sm"
              variant="outline"
              :disabled="busy === role.roleId"
              @click="claim(role.roleId)"
            >
              {{ t('meetings.signUp') }}
            </Button>
            <!-- Manager: assign or reassign anyone (member or guest) -->
            <Button
              v-if="canManage"
              size="sm"
              variant="ghost"
              :disabled="busy === role.roleId"
              @click="toggleAssign(role.roleId)"
            >
              <UserPlus class="size-4" />
              {{ role.occupant ? t('meetings.reassign') : t('meetings.assignOpen') }}
            </Button>
            <!-- Release -->
            <Button
              v-if="canRelease(role)"
              size="sm"
              variant="ghost"
              class="text-muted-foreground hover:text-destructive"
              :disabled="busy === role.roleId"
              @click="release(role.roleId)"
            >
              <X class="size-4" />
              {{ t('meetings.release') }}
            </Button>
          </div>

          <!-- Manager assign panel -->
          <MeetingAssignPanel
            v-if="assignFor === role.roleId"
            :id-prefix="`role-${role.roleId}`"
            :members="members"
            :busy="busy === role.roleId"
            @assign="target => assignRole(role.roleId, target)"
          />
        </li>
      </ul>

      <!-- Speeches -->
      <template v-if="data!.speeches.length">
        <h2 class="mt-8 text-xl font-semibold">
          {{ t('meetings.speeches') }}
        </h2>
        <div class="mt-3 space-y-3">
          <div
            v-for="s in data!.speeches"
            :key="s.slot"
            class="rounded-lg border border-border p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="text-xs font-semibold uppercase tracking-wide text-secondary">
                {{ t('meetings.speechNum', { n: s.slot }) }}
              </div>

              <!-- Timing window (default 5–7 min) -->
              <div
                v-if="canEditTitle(s) && timeEdits[s.slot]"
                class="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span>{{ t('meetings.timeWindow') }}</span>
                <input
                  :id="`min-${s.slot}`"
                  v-model.number="timeEdits[s.slot]!.min"
                  type="number"
                  min="1"
                  class="h-8 w-14 rounded-md border border-input bg-transparent px-2 text-sm"
                  :aria-label="t('meetings.minTime')"
                >
                <span>–</span>
                <input
                  :id="`max-${s.slot}`"
                  v-model.number="timeEdits[s.slot]!.max"
                  type="number"
                  min="1"
                  class="h-8 w-14 rounded-md border border-input bg-transparent px-2 text-sm"
                  :aria-label="t('meetings.maxTime')"
                >
                <span>{{ t('meetings.minShort') }}</span>
                <Button
                  v-if="timeDirty(s)"
                  size="sm"
                  :disabled="!timeValid(s)"
                  @click="saveTime(s.slot)"
                >
                  {{ t('meetings.saveTitle') }}
                </Button>
              </div>
              <div
                v-else
                class="text-xs text-muted-foreground"
              >
                {{ s.minMinutes }}–{{ s.maxMinutes }} {{ t('meetings.minShort') }}
              </div>
            </div>

            <!-- Title -->
            <div class="mt-2">
              <template v-if="canEditTitle(s)">
                <div class="flex items-end gap-2">
                  <div class="flex-1 space-y-1.5">
                    <Label
                      :for="`title-${s.slot}`"
                      class="text-xs text-muted-foreground"
                    >{{ t('meetings.speechTitle') }}</Label>
                    <Input
                      :id="`title-${s.slot}`"
                      v-model="titleEdits[s.slot]"
                      :placeholder="t('meetings.speechTitlePlaceholder')"
                    />
                  </div>
                  <Button
                    v-if="titleDirty(s)"
                    size="sm"
                    @click="saveTitle(s.slot, titleEdits[s.slot]!)"
                  >
                    {{ t('meetings.saveTitle') }}
                  </Button>
                </div>
              </template>
              <div
                v-else
                class="font-medium"
              >
                {{ s.title || t('meetings.untitledSpeech') }}
              </div>
            </div>

            <!-- Speaker & evaluator -->
            <ul class="mt-3 divide-y divide-border rounded-md border border-border">
              <li
                v-for="f in speechFields"
                :key="f"
                class="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
              >
                <div class="min-w-32">
                  <div class="text-sm font-medium">
                    {{ fieldLabel(f) }}
                  </div>
                  <div
                    v-if="occupantOf(s, f)"
                    class="text-sm text-muted-foreground"
                  >
                    {{ occupantOf(s, f)!.name }}
                    <span
                      v-if="occupantOf(s, f)!.isGuest"
                      class="text-xs"
                    >({{ t('meetings.guest') }})</span>
                  </div>
                  <div
                    v-else
                    class="text-sm text-muted-foreground/70"
                  >
                    {{ t('meetings.open') }}
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <Button
                    v-if="!occupantOf(s, f) && isMember"
                    size="sm"
                    variant="outline"
                    :disabled="busy === speechKey(s.slot, f)"
                    @click="claimSpeech(s.slot, f)"
                  >
                    {{ t('meetings.signUp') }}
                  </Button>
                  <Button
                    v-if="canManage"
                    size="sm"
                    variant="ghost"
                    :disabled="busy === speechKey(s.slot, f)"
                    @click="toggleAssign(speechKey(s.slot, f))"
                  >
                    <UserPlus class="size-4" />
                    {{ occupantOf(s, f) ? t('meetings.reassign') : t('meetings.assignOpen') }}
                  </Button>
                  <Button
                    v-if="canReleaseSlot(s, f)"
                    size="sm"
                    variant="ghost"
                    class="text-muted-foreground hover:text-destructive"
                    :disabled="busy === speechKey(s.slot, f)"
                    @click="releaseSpeech(s.slot, f)"
                  >
                    <X class="size-4" />
                    {{ t('meetings.release') }}
                  </Button>
                </div>

                <MeetingAssignPanel
                  v-if="assignFor === speechKey(s.slot, f)"
                  :id-prefix="speechKey(s.slot, f)"
                  :members="members"
                  :busy="busy === speechKey(s.slot, f)"
                  @assign="target => assignSpeech(s.slot, f, target)"
                />
              </li>
            </ul>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
