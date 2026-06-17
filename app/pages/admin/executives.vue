<script setup lang="ts">
import { Check, Plus, Trash2, UserX } from '@lucide/vue'

definePageMeta({ middleware: 'admin' })

const { t } = useI18n()

interface Position {
  id: string
  nameEn: string
  nameFr: string
  canManageCalendar: boolean
  canManageContent: boolean
  canAssignOfficers: boolean
  canManageMinutes: boolean
  active: boolean
  holderId: string | null
  holderName: string | null
}
interface Member { id: string, name: string, status: string }

const { data: posData, refresh } = await useFetch<{ positions: Position[] }>('/api/admin/executive-positions', { key: 'admin-exec-positions' })
const { data: memData } = await useFetch<{ members: Member[] }>('/api/admin/members', { key: 'admin-members' })

const positions = ref<Position[]>([])
watchEffect(() => {
  positions.value = (posData.value?.positions ?? []).map(p => ({ ...p }))
})
const members = computed(() => memData.value?.members ?? [])

const assignChoice = reactive<Record<string, string>>({})
const newPosition = reactive({ nameEn: '', nameFr: '' })
const saving = ref(false)
const saved = ref(false)
const error = ref('')

function fail(e: unknown) {
  error.value = errorMessage(e, t('auth.genericError'))
  saved.value = false
}

async function saveAll() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    for (const p of positions.value) {
      await $fetch(`/api/admin/executive-positions/${p.id}`, {
        method: 'PATCH',
        body: { nameEn: p.nameEn, nameFr: p.nameFr, canManageCalendar: p.canManageCalendar, canManageContent: p.canManageContent, canAssignOfficers: p.canAssignOfficers, canManageMinutes: p.canManageMinutes, active: p.active },
      })
    }
    saved.value = true
  }
  catch (e) { fail(e) }
  finally { saving.value = false }
}

async function addPosition() {
  if (!newPosition.nameEn.trim() || !newPosition.nameFr.trim()) return
  error.value = ''
  try {
    await $fetch('/api/admin/executive-positions', { method: 'POST', body: { ...newPosition } })
    newPosition.nameEn = ''
    newPosition.nameFr = ''
    await refresh()
  }
  catch (e) { fail(e) }
}

async function removePosition(id: string) {
  error.value = ''
  try {
    await $fetch(`/api/admin/executive-positions/${id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (e) { fail(e) }
}

async function assign(id: string) {
  const userId = assignChoice[id]
  if (!userId) return
  error.value = ''
  try {
    await $fetch(`/api/admin/executive-positions/${id}/assign`, { method: 'POST', body: { userId } })
    assignChoice[id] = ''
    await refresh()
  }
  catch (e) { fail(e) }
}

async function vacate(id: string) {
  error.value = ''
  try {
    await $fetch(`/api/admin/executive-positions/${id}/vacate`, { method: 'POST' })
    await refresh()
  }
  catch (e) { fail(e) }
}

useHead(() => ({ title: t('admin.executives.title') }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight">
      {{ t('admin.executives.title') }}
    </h1>
    <p class="mt-2 text-sm text-muted-foreground">
      {{ t('admin.executives.intro') }}
    </p>

    <div
      v-if="saved"
      class="mt-6 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
    >
      <Check class="size-4" /> {{ t('admin.saved') }}
    </div>
    <div
      v-else-if="error"
      class="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {{ error }}
    </div>

    <div class="mt-8 space-y-3">
      <Card
        v-for="p in positions"
        :key="p.id"
        :class="p.active ? '' : 'opacity-60'"
      >
        <CardContent class="space-y-4 py-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label :for="`en-${p.id}`">{{ t('admin.executives.nameEn') }}</Label>
              <Input
                :id="`en-${p.id}`"
                v-model="p.nameEn"
              />
            </div>
            <div class="space-y-1.5">
              <Label :for="`fr-${p.id}`">{{ t('admin.executives.nameFr') }}</Label>
              <Input
                :id="`fr-${p.id}`"
                v-model="p.nameFr"
              />
            </div>
          </div>

          <!-- Current holder + assignment -->
          <div class="flex flex-wrap items-end gap-3">
            <div class="flex-1">
              <div class="text-xs text-muted-foreground">
                {{ t('admin.executives.holder') }}
              </div>
              <div
                v-if="p.holderName"
                class="font-medium"
              >
                {{ p.holderName }}
              </div>
              <div
                v-else
                class="text-sm text-muted-foreground/70"
              >
                {{ t('admin.executives.vacant') }}
              </div>
            </div>
            <div class="space-y-1.5">
              <Label :for="`assign-${p.id}`">{{ t('admin.executives.assign') }}</Label>
              <select
                :id="`assign-${p.id}`"
                v-model="assignChoice[p.id]"
                class="flex h-9 w-56 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                <option value="">
                  {{ t('admin.executives.choose') }}
                </option>
                <option
                  v-for="m in members"
                  :key="m.id"
                  :value="m.id"
                >
                  {{ m.name }}
                </option>
              </select>
            </div>
            <Button
              size="sm"
              :disabled="!assignChoice[p.id]"
              @click="assign(p.id)"
            >
              {{ t('admin.executives.assignCta') }}
            </Button>
            <Button
              v-if="p.holderId"
              size="sm"
              variant="ghost"
              class="text-muted-foreground hover:text-destructive"
              @click="vacate(p.id)"
            >
              <UserX class="size-4" /> {{ t('admin.executives.vacate') }}
            </Button>
          </div>

          <!-- Capability flags + active + delete -->
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-sm">
            <label class="flex items-center gap-2">
              <input
                v-model="p.canManageCalendar"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
              >
              {{ t('admin.executives.capCalendar') }}
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="p.canManageContent"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
              >
              {{ t('admin.executives.capContent') }}
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="p.canAssignOfficers"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
              >
              {{ t('admin.executives.capOfficers') }}
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="p.canManageMinutes"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
              >
              {{ t('admin.executives.capMinutes') }}
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="p.active"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
              >
              {{ t('admin.roles.active') }}
            </label>
            <Button
              variant="ghost"
              size="icon"
              class="ml-auto text-muted-foreground hover:text-destructive"
              :aria-label="t('admin.executives.delete')"
              @click="removePosition(p.id)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card class="mt-6 border-dashed">
      <CardHeader>
        <CardTitle class="text-base">
          {{ t('admin.executives.addTitle') }}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          class="flex flex-col gap-3 sm:flex-row sm:items-end"
          @submit.prevent="addPosition"
        >
          <div class="flex-1 space-y-1.5">
            <Label for="new-pos-en">{{ t('admin.executives.nameEn') }}</Label>
            <Input
              id="new-pos-en"
              v-model="newPosition.nameEn"
            />
          </div>
          <div class="flex-1 space-y-1.5">
            <Label for="new-pos-fr">{{ t('admin.executives.nameFr') }}</Label>
            <Input
              id="new-pos-fr"
              v-model="newPosition.nameFr"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            :disabled="!newPosition.nameEn.trim() || !newPosition.nameFr.trim()"
          >
            <Plus class="size-4" /> {{ t('admin.roles.add') }}
          </Button>
        </form>
      </CardContent>
    </Card>

    <div class="sticky bottom-4 mt-8">
      <Button
        size="lg"
        :disabled="saving"
        @click="saveAll"
      >
        {{ saving ? t('admin.saving') : t('admin.save') }}
      </Button>
    </div>
  </div>
</template>
