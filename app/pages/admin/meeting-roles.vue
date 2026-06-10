<script setup lang="ts">
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from '@lucide/vue'

definePageMeta({ middleware: 'admin' })

const { t } = useI18n()

interface Role {
  id: string
  nameEn: string
  nameFr: string
  descriptionEn: string | null
  descriptionFr: string | null
  active: boolean
  grantsMeetingAuthority: boolean
  isMeetingOfficer: boolean
  sortOrder: number
}

const { data, refresh } = await useFetch<{ roles: Role[] }>('/api/admin/meeting-roles', {
  key: 'admin-meeting-roles',
})
const roles = ref<Role[]>([])
watchEffect(() => {
  roles.value = (data.value?.roles ?? []).map(r => ({ ...r }))
})

const newRole = reactive({ nameEn: '', nameFr: '' })
const saving = ref(false)
const saved = ref(false)
const error = ref('')

function flash() {
  saved.value = true
  error.value = ''
}
function fail(e: unknown) {
  error.value = errorMessage(e, t('auth.genericError'))
  saved.value = false
}

async function saveAll() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    for (const r of roles.value) {
      await $fetch(`/api/admin/meeting-roles/${r.id}`, {
        method: 'PATCH',
        body: { nameEn: r.nameEn, nameFr: r.nameFr, descriptionEn: r.descriptionEn, descriptionFr: r.descriptionFr, active: r.active, grantsMeetingAuthority: r.grantsMeetingAuthority, isMeetingOfficer: r.isMeetingOfficer },
      })
    }
    flash()
  }
  catch (e) { fail(e) }
  finally { saving.value = false }
}

async function addRole() {
  if (!newRole.nameEn.trim() || !newRole.nameFr.trim()) return
  error.value = ''
  try {
    await $fetch('/api/admin/meeting-roles', { method: 'POST', body: { ...newRole } })
    newRole.nameEn = ''
    newRole.nameFr = ''
    await refresh()
  }
  catch (e) { fail(e) }
}

async function removeRole(id: string) {
  error.value = ''
  try {
    await $fetch(`/api/admin/meeting-roles/${id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (e) { fail(e) }
}

async function move(index: number, dir: -1 | 1) {
  const target = index + dir
  if (target < 0 || target >= roles.value.length) return
  const arr = roles.value
  ;[arr[index], arr[target]] = [arr[target]!, arr[index]!]
  try {
    await $fetch('/api/admin/meeting-roles/reorder', { method: 'POST', body: { ids: arr.map(r => r.id) } })
  }
  catch (e) { fail(e) }
}

useHead(() => ({ title: t('admin.roles.title') }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight">
      {{ t('admin.roles.title') }}
    </h1>
    <p class="mt-2 text-sm text-muted-foreground">
      {{ t('admin.roles.intro') }}
    </p>

    <div
      v-if="saved"
      class="mt-6 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
    >
      <Check class="size-4" />
      {{ t('admin.saved') }}
    </div>
    <div
      v-else-if="error"
      class="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {{ error }}
    </div>

    <div class="mt-8 space-y-3">
      <Card
        v-for="(role, index) in roles"
        :key="role.id"
        :class="role.active ? '' : 'opacity-60'"
      >
        <CardContent class="flex items-start gap-3 py-4">
          <div class="flex flex-col gap-1 pt-6">
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              :disabled="index === 0"
              :aria-label="t('admin.roles.moveUp')"
              @click="move(index, -1)"
            >
              <ArrowUp class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              :disabled="index === roles.length - 1"
              :aria-label="t('admin.roles.moveDown')"
              @click="move(index, 1)"
            >
              <ArrowDown class="size-4" />
            </Button>
          </div>

          <div class="grid flex-1 gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label :for="`en-${role.id}`">{{ t('admin.roles.nameEn') }}</Label>
              <Input
                :id="`en-${role.id}`"
                v-model="role.nameEn"
              />
            </div>
            <div class="space-y-1.5">
              <Label :for="`fr-${role.id}`">{{ t('admin.roles.nameFr') }}</Label>
              <Input
                :id="`fr-${role.id}`"
                v-model="role.nameFr"
              />
            </div>
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2">
              <div class="flex items-center gap-2">
                <input
                  :id="`active-${role.id}`"
                  v-model="role.active"
                  type="checkbox"
                  class="size-4 rounded border-input accent-primary"
                >
                <Label
                  :for="`active-${role.id}`"
                  class="font-normal"
                >{{ t('admin.roles.active') }}</Label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  :id="`authority-${role.id}`"
                  v-model="role.grantsMeetingAuthority"
                  type="checkbox"
                  class="size-4 rounded border-input accent-primary"
                >
                <Label
                  :for="`authority-${role.id}`"
                  class="font-normal"
                >{{ t('admin.roles.authority') }}</Label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  :id="`officer-${role.id}`"
                  v-model="role.isMeetingOfficer"
                  type="checkbox"
                  class="size-4 rounded border-input accent-primary"
                >
                <Label
                  :for="`officer-${role.id}`"
                  class="font-normal"
                >{{ t('admin.roles.officer') }}</Label>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            class="mt-6 text-muted-foreground hover:text-destructive"
            :aria-label="t('admin.roles.delete')"
            @click="removeRole(role.id)"
          >
            <Trash2 class="size-4" />
          </Button>
        </CardContent>
      </Card>
    </div>

    <!-- Add a new role -->
    <Card class="mt-6 border-dashed">
      <CardHeader>
        <CardTitle class="text-base">
          {{ t('admin.roles.addTitle') }}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          class="flex flex-col gap-3 sm:flex-row sm:items-end"
          @submit.prevent="addRole"
        >
          <div class="flex-1 space-y-1.5">
            <Label for="new-en">{{ t('admin.roles.nameEn') }}</Label>
            <Input
              id="new-en"
              v-model="newRole.nameEn"
            />
          </div>
          <div class="flex-1 space-y-1.5">
            <Label for="new-fr">{{ t('admin.roles.nameFr') }}</Label>
            <Input
              id="new-fr"
              v-model="newRole.nameFr"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            :disabled="!newRole.nameEn.trim() || !newRole.nameFr.trim()"
          >
            <Plus class="size-4" />
            {{ t('admin.roles.add') }}
          </Button>
        </form>
      </CardContent>
    </Card>

    <div class="sticky bottom-4 mt-8 flex items-center gap-3">
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
