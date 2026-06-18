<script setup lang="ts">
import { Check, ShieldCheck } from '@lucide/vue'

definePageMeta({ middleware: 'grants' })

const { t, locale } = useI18n()
const { user } = useUserSession()

// Only admins may edit the per-position matrix (the PATCH endpoint is admin-only).
// A non-admin grant manager (e.g. the President) still manages the individual
// delegations below, but sees the position matrix read-only.
const isAdmin = computed(() => hasMinRole(user.value?.status, 'admin'))

type Capability = 'content_edit' | 'calendar_manage'
type Group = 'people' | 'meetings' | 'content' | 'communication' | 'config'
interface Member { id: string, name: string, email: string, status: string }
interface Grant { id: string, userId: string, userName: string, capability: Capability, createdAt: string, grantedByName: string | null }
interface Position {
  id: string
  nameEn: string
  nameFr: string
  active: boolean
  holderName: string | null
  writePeople: boolean
  writeMeetings: boolean
  writeContent: boolean
  writeCommunication: boolean
  writeConfig: boolean
}

const CAPS: Capability[] = ['calendar_manage', 'content_edit']
// One column per functional group of the executive hub (issue #47); the field
// is the matching write-access column on the position.
const GROUPS: { key: Group, field: keyof Position }[] = [
  { key: 'people', field: 'writePeople' },
  { key: 'meetings', field: 'writeMeetings' },
  { key: 'content', field: 'writeContent' },
  { key: 'communication', field: 'writeCommunication' },
  { key: 'config', field: 'writeConfig' },
]

const { data: posData, refresh: refreshPositions } = await useFetch<{ positions: Position[] }>('/api/admin/executive-positions', { key: 'admin-exec-positions' })
const { data: memData } = await useFetch<{ members: Member[] }>('/api/admin/members', { key: 'admin-members' })
const { data: grantData, refresh } = await useFetch<{ grants: Grant[] }>('/api/admin/permission-grants', { key: 'admin-permission-grants' })

const positions = computed(() => posData.value?.positions ?? [])
function positionName(p: Position) {
  return locale.value === 'fr' ? p.nameFr : p.nameEn
}
function groupLabel(g: Group) {
  return t(`executive.groups.${g}`)
}

// Non-admin members/officers only: admins implicitly hold every capability, so
// a grant to them is meaningless (effectiveCapabilities short-circuits admin).
const members = computed(() => (memData.value?.members ?? []).filter(m => m.status !== 'admin'))

// Quick lookup of the active grant id for a (user, capability) pair, or null.
const grantId = computed(() => {
  const map = new Map<string, string>()
  for (const g of grantData.value?.grants ?? []) map.set(`${g.userId}:${g.capability}`, g.id)
  return map
})
function held(userId: string, cap: Capability) {
  return grantId.value.get(`${userId}:${cap}`) ?? null
}

const busy = ref<string>('')
const error = ref('')

// Toggle one position × group cell (admin only). The matrix is keyed to the
// position, never the person currently holding it.
async function toggleGroup(p: Position, field: keyof Position) {
  if (!isAdmin.value) return
  const key = `${p.id}:${field}`
  if (busy.value) return
  busy.value = key
  error.value = ''
  try {
    await $fetch(`/api/admin/executive-positions/${p.id}`, { method: 'PATCH', body: { [field]: !p[field] } })
    await refreshPositions()
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.genericError'))
  }
  finally {
    busy.value = ''
  }
}

async function toggle(userId: string, cap: Capability) {
  const key = `${userId}:${cap}`
  if (busy.value) return
  busy.value = key
  error.value = ''
  try {
    const existing = held(userId, cap)
    if (existing) {
      await $fetch(`/api/admin/permission-grants/${existing}`, { method: 'DELETE' })
    }
    else {
      await $fetch('/api/admin/permission-grants', { method: 'POST', body: { userId, capability: cap } })
    }
    await refresh()
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.genericError'))
  }
  finally {
    busy.value = ''
  }
}

function capLabel(cap: Capability) {
  return cap === 'calendar_manage' ? t('admin.permissions.capCalendar') : t('admin.permissions.capContent')
}

useHead(() => ({ title: t('admin.permissions.title') }))
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-12">
    <h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight">
      <ShieldCheck class="size-7 text-primary" /> {{ t('admin.permissions.title') }}
    </h1>
    <p class="mt-2 text-sm text-muted-foreground">
      {{ t('admin.permissions.intro') }}
    </p>

    <div
      v-if="error"
      class="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {{ error }}
    </div>

    <!-- Per-position write-access matrix (issue #47) -->
    <h2 class="mt-8 text-lg font-semibold tracking-tight">
      {{ t('admin.permissions.matrixTitle') }}
    </h2>
    <p class="mt-1 text-sm text-muted-foreground">
      {{ t('admin.permissions.matrixIntro') }}
    </p>

    <Card class="mt-4">
      <CardContent class="overflow-x-auto p-0">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-left text-xs text-muted-foreground">
              <th class="sticky left-0 bg-card px-4 py-3 font-medium">
                {{ t('admin.permissions.position') }}
              </th>
              <th
                v-for="g in GROUPS"
                :key="g.key"
                class="px-3 py-3 text-center font-medium"
              >
                {{ groupLabel(g.key) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in positions"
              :key="p.id"
              class="border-b border-border last:border-0"
              :class="p.active ? '' : 'opacity-50'"
            >
              <td class="sticky left-0 bg-card px-4 py-3">
                <div class="font-medium">
                  {{ positionName(p) }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ p.holderName || t('admin.executives.vacant') }}
                </div>
              </td>
              <td
                v-for="g in GROUPS"
                :key="g.key"
                class="px-3 py-3 text-center"
              >
                <button
                  type="button"
                  role="switch"
                  :aria-checked="!!p[g.field]"
                  :aria-label="`${groupLabel(g.key)} — ${positionName(p)}`"
                  :disabled="!isAdmin || busy === `${p.id}:${String(g.field)}`"
                  class="inline-flex items-center justify-center rounded-md border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                  :class="p[g.field]
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-input text-muted-foreground hover:bg-muted'"
                  @click="toggleGroup(p, g.field)"
                >
                  <Check
                    v-if="p[g.field]"
                    class="mr-1 size-3.5"
                  />
                  {{ p[g.field] ? t('admin.permissions.canWrite') : t('admin.permissions.noWrite') }}
                </button>
              </td>
            </tr>
            <tr v-if="!positions.length">
              <td
                :colspan="GROUPS.length + 1"
                class="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                {{ t('admin.permissions.noPositions') }}
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>

    <p class="mt-3 text-xs text-muted-foreground">
      {{ t('admin.permissions.matrixNote') }}
    </p>
    <p
      v-if="!isAdmin"
      class="mt-1 text-xs font-medium text-amber-700"
    >
      {{ t('admin.permissions.matrixReadOnly') }}
    </p>

    <!-- Individual delegations to specific members -->
    <h2 class="mt-12 text-lg font-semibold tracking-tight">
      {{ t('admin.permissions.delegationsTitle') }}
    </h2>
    <p class="mt-1 text-sm text-muted-foreground">
      {{ t('admin.permissions.intro') }}
    </p>

    <Card class="mt-4">
      <CardContent class="p-0">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-left text-xs text-muted-foreground">
              <th class="px-4 py-3 font-medium">
                {{ t('admin.permissions.member') }}
              </th>
              <th
                v-for="cap in CAPS"
                :key="cap"
                class="px-4 py-3 text-center font-medium"
              >
                {{ capLabel(cap) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in members"
              :key="m.id"
              class="border-b border-border last:border-0"
            >
              <td class="px-4 py-3">
                <div class="font-medium">
                  {{ m.name }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ m.email }}
                </div>
              </td>
              <td
                v-for="cap in CAPS"
                :key="cap"
                class="px-4 py-3 text-center"
              >
                <button
                  type="button"
                  role="switch"
                  :aria-checked="!!held(m.id, cap)"
                  :aria-label="`${capLabel(cap)} — ${m.name}`"
                  :disabled="busy === `${m.id}:${cap}`"
                  class="inline-flex items-center justify-center rounded-md border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                  :class="held(m.id, cap)
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-input text-muted-foreground hover:bg-muted'"
                  @click="toggle(m.id, cap)"
                >
                  <Check
                    v-if="held(m.id, cap)"
                    class="mr-1 size-3.5"
                  />
                  {{ held(m.id, cap) ? t('admin.permissions.granted') : t('admin.permissions.grant') }}
                </button>
              </td>
            </tr>
            <tr v-if="!members.length">
              <td
                colspan="3"
                class="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                {{ t('admin.permissions.empty') }}
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>

    <p class="mt-4 text-xs text-muted-foreground">
      {{ t('admin.permissions.note') }}
    </p>
  </div>
</template>
