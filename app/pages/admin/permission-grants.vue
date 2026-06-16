<script setup lang="ts">
import { Check, ShieldCheck } from '@lucide/vue'

definePageMeta({ middleware: 'grants' })

const { t } = useI18n()

type Capability = 'content_edit' | 'calendar_manage'
interface Member { id: string, name: string, email: string, status: string }
interface Grant { id: string, userId: string, userName: string, capability: Capability, createdAt: string, grantedByName: string | null }

const CAPS: Capability[] = ['calendar_manage', 'content_edit']

const { data: memData } = await useFetch<{ members: Member[] }>('/api/admin/members', { key: 'admin-members' })
const { data: grantData, refresh } = await useFetch<{ grants: Grant[] }>('/api/admin/permission-grants', { key: 'admin-permission-grants' })

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
  <div class="mx-auto max-w-3xl px-4 py-12">
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

    <Card class="mt-8">
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
