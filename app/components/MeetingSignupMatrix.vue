<script setup lang="ts">
import { CalendarDays, Plus } from '@lucide/vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Member-only signup matrix (meetings page): roles + speech slots as rows, the
// next 5 meetings as columns. Each cell opens a popover carrying the same
// claim / assign / release actions as the per-meeting signup page, posting to
// the same endpoints. The viewer is always member+ (the API requires it).
interface Occupant { userId: string | null, name: string | null, isGuest: boolean }
interface RoleInfo { roleId: string, nameEn: string, nameFr: string }
interface MatrixMeeting {
  id: string
  date: string
  meetingNumber: number | null
  themeEn: string | null
  themeFr: string | null
  canManage: boolean
  roleOccupants: Record<string, Occupant>
  speeches: Record<string, { speaker: Occupant | null, evaluator: Occupant | null }>
}
interface MatrixData { slotCount: number, roles: RoleInfo[], meetings: MatrixMeeting[] }

const { locale, t } = useI18n()
const localePath = useLocalePath()
const { user } = useUserSession()

const { data, refresh } = await useFetch<MatrixData>('/api/meetings/matrix', { key: 'meetings-matrix' })

const meetings = computed(() => data.value?.meetings ?? [])
const roles = computed(() => data.value?.roles ?? [])
const slots = computed(() => Array.from({ length: data.value?.slotCount ?? 0 }, (_, i) => i + 1))

// Member roster for the assign dropdown — loaded once the viewer manages at
// least one of the matrix meetings.
interface Member { id: string, name: string }
const anyManage = computed(() => meetings.value.some(m => m.canManage))
const { data: memberData, execute: loadMembers } = await useFetch<{ members: Member[] }>('/api/meetings/members', {
  key: 'meeting-members',
  immediate: false,
})
watch(anyManage, (v) => {
  if (v && !memberData.value) loadMembers()
}, { immediate: true })
const members = computed(() => memberData.value?.members ?? [])

// One row per role, then "Speech N" speaker/evaluator pairs.
type SpeechField = 'speaker' | 'evaluator'
type Row
  = | { key: string, kind: 'role', roleId: string, label: string, sub: null }
    | { key: string, kind: 'speech', slot: number, field: SpeechField, label: string, sub: string }
const rows = computed<Row[]>(() => {
  const roleRows: Row[] = roles.value.map(r => ({
    key: `role-${r.roleId}`,
    kind: 'role',
    roleId: r.roleId,
    label: locale.value === 'fr' ? r.nameFr : r.nameEn,
    sub: null,
  }))
  const speechRows: Row[] = slots.value.flatMap(slot =>
    (['speaker', 'evaluator'] as const).map(field => ({
      key: `speech-${slot}-${field}`,
      kind: 'speech' as const,
      slot,
      field,
      label: field === 'speaker' ? t('meetings.speaker') : t('meetings.evaluator'),
      sub: t('meetings.speechNum', { n: slot }),
    })),
  )
  return [...roleRows, ...speechRows]
})

function occupantAt(row: Row, m: MatrixMeeting): Occupant | null {
  if (row.kind === 'role') return m.roleOccupants[row.roleId] ?? null
  return m.speeches[String(row.slot)]?.[row.field] ?? null
}
const isSelf = (occ: Occupant | null) => !!occ?.userId && occ.userId === user.value?.id
function canRelease(row: Row, m: MatrixMeeting) {
  const occ = occupantAt(row, m)
  return !!occ && (m.canManage || isSelf(occ))
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric' })
    .format(new Date(`${iso}T00:00:00`))

const busy = ref('')
const error = ref('')
const openCell = ref<string | null>(null)
const cellKey = (row: Row, m: MatrixMeeting) => `${m.id}:${row.key}`

type AssignTarget = { userId: string } | { guestName: string }
async function mutate(row: Row, m: MatrixMeeting, method: 'POST' | 'DELETE', target?: AssignTarget) {
  busy.value = cellKey(row, m)
  error.value = ''
  try {
    const body = row.kind === 'role'
      ? { meetingId: m.id, roleId: row.roleId, ...(target ?? {}) }
      : { meetingId: m.id, slot: row.slot, field: row.field, ...(target ?? {}) }
    const path = row.kind === 'role' ? '/api/meetings/signup' : '/api/meetings/speech'
    await $fetch(path, { method, body })
    openCell.value = null
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = '' }
}
</script>

<template>
  <div v-if="meetings.length">
    <div
      v-if="error"
      class="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive"
    >
      {{ error }}
    </div>

    <div class="overflow-x-auto rounded-lg border border-border">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th class="sticky left-0 z-10 min-w-28 bg-background px-3 py-2" />
            <th
              v-for="m in meetings"
              :key="m.id"
              class="min-w-[6.5rem] border-l border-border px-1.5 py-2 text-center font-medium"
            >
              <NuxtLink
                :to="localePath(`/meeting/${m.date}`)"
                class="text-secondary hover:underline"
              >
                {{ fmtDate(m.date) }}
              </NuxtLink>
              <div
                v-if="m.meetingNumber != null"
                class="text-xs font-normal text-muted-foreground"
              >
                {{ t('meetings.meetingNo', { n: m.meetingNumber }) }}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="(row, ri) in rows"
            :key="row.key"
          >
            <!-- One-time divider before the first speech row -->
            <tr v-if="row.kind === 'speech' && rows[ri - 1]?.kind !== 'speech'">
              <th class="sticky left-0 z-10 border-t border-border bg-muted px-3 py-1.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {{ t('meetings.speeches') }}
              </th>
              <td
                :colspan="meetings.length"
                class="border-t border-border bg-muted/50"
              />
            </tr>
            <tr>
              <th class="sticky left-0 z-10 max-w-36 border-t border-border bg-background px-3 py-1.5 text-left">
                <div class="truncate font-medium">
                  {{ row.label }}
                </div>
                <div
                  v-if="row.sub"
                  class="truncate text-xs font-normal text-muted-foreground"
                >
                  {{ row.sub }}
                </div>
              </th>
              <td
                v-for="m in meetings"
                :key="m.id"
                class="border-t border-l border-border p-0 text-center"
              >
                <Popover
                  :open="openCell === cellKey(row, m)"
                  @update:open="v => openCell = v ? cellKey(row, m) : null"
                >
                  <PopoverTrigger
                    class="flex h-10 w-full items-center justify-center px-1.5 text-xs transition-colors hover:bg-muted"
                    :class="isSelf(occupantAt(row, m)) ? 'font-semibold text-secondary' : occupantAt(row, m) ? '' : 'text-muted-foreground/60'"
                  >
                    <span
                      v-if="occupantAt(row, m)"
                      class="max-w-24 truncate"
                      :title="occupantAt(row, m)!.name ?? undefined"
                    >{{ occupantAt(row, m)!.name }}</span>
                    <Plus
                      v-else
                      class="size-3.5"
                      :aria-label="t('meetings.signUp')"
                    />
                  </PopoverTrigger>
                  <PopoverContent class="space-y-3">
                    <div>
                      <div class="text-sm font-semibold">
                        {{ row.label }}<template v-if="row.sub">
                          — {{ row.sub }}
                        </template>
                      </div>
                      <div class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays class="size-3.5" />
                        {{ fmtDate(m.date) }}
                      </div>
                    </div>

                    <div
                      v-if="occupantAt(row, m)"
                      class="text-sm"
                    >
                      {{ occupantAt(row, m)!.name }}
                      <span
                        v-if="occupantAt(row, m)!.isGuest"
                        class="text-xs text-muted-foreground"
                      >({{ t('meetings.guest') }})</span>
                    </div>
                    <div
                      v-else
                      class="text-sm text-muted-foreground/70"
                    >
                      {{ t('meetings.open') }}
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <Button
                        v-if="!occupantAt(row, m)"
                        size="sm"
                        variant="outline"
                        :disabled="busy === cellKey(row, m)"
                        @click="mutate(row, m, 'POST')"
                      >
                        {{ t('meetings.signUp') }}
                      </Button>
                      <Button
                        v-if="canRelease(row, m)"
                        size="sm"
                        variant="ghost"
                        class="text-muted-foreground hover:text-destructive"
                        :disabled="busy === cellKey(row, m)"
                        @click="mutate(row, m, 'DELETE')"
                      >
                        {{ t('meetings.release') }}
                      </Button>
                    </div>

                    <!-- Manager: assign any member or a guest (same panel as the signup page) -->
                    <MeetingAssignPanel
                      v-if="m.canManage"
                      :id-prefix="cellKey(row, m)"
                      :members="members"
                      :busy="busy === cellKey(row, m)"
                      @assign="target => mutate(row, m, 'POST', target)"
                    />
                  </PopoverContent>
                </Popover>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p
      v-if="meetings.length > 2"
      class="mt-2 text-xs text-muted-foreground sm:hidden"
    >
      {{ t('meetings.swipeHint') }}
    </p>
  </div>
</template>
