<script setup lang="ts">
import { Check, Plus, Send, Trash2, TriangleAlert } from '@lucide/vue'

definePageMeta({ middleware: 'officer' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

interface Template {
  id: string
  key: string
  descriptionEn: string | null
  descriptionFr: string | null
  subjectEn: string
  subjectFr: string
  bodyEn: string
  bodyFr: string
}
interface Schedule {
  id: string
  templateKey: string
  dayOfWeek: number
  timeOfDay: string
  active: boolean
}
interface LogRow {
  id: string
  templateKey: string
  trigger: 'manual' | 'scheduled'
  status: 'sent' | 'stubbed' | 'failed'
  recipientCount: number
  error: string | null
  sentAt: string
  triggeredByName: string | null
}

const { data: tplData } = await useFetch<{ templates: Template[], configured: boolean }>(
  '/api/admin/email-templates', { key: 'admin-email-templates' },
)
const { data: schedData, refresh: refreshSchedules } = await useFetch<{ schedules: Schedule[] }>(
  '/api/admin/email-schedules', { key: 'admin-email-schedules' },
)
const { data: logData, refresh: refreshLog } = await useFetch<{ log: LogRow[] }>(
  '/api/admin/email-log', { key: 'admin-email-log' },
)

const templates = ref<Template[]>([])
watchEffect(() => {
  templates.value = (tplData.value?.templates ?? []).map(x => ({ ...x }))
})
const configured = computed(() => tplData.value?.configured ?? false)
const schedules = computed(() => schedData.value?.schedules ?? [])
const log = computed(() => logData.value?.log ?? [])

const saved = ref(false)
const error = ref('')
const sendingKey = ref('')
const sendResult = ref('')

function flash() {
  saved.value = true
  error.value = ''
}
function fail(e: unknown) {
  error.value = errorMessage(e, t('auth.genericError'))
  saved.value = false
}

// Localized weekday names, 0 = Sunday (2024-01-07 is a Sunday).
const dayNames = computed(() =>
  Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(locale.value === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long' })),
)
function localizedSubject(tpl: Template) {
  return locale.value === 'fr' ? tpl.subjectFr : tpl.subjectEn
}

async function saveTemplate(tpl: Template) {
  error.value = ''
  try {
    await $fetch(`/api/admin/email-templates/${tpl.key}`, {
      method: 'PUT',
      body: { subjectEn: tpl.subjectEn, subjectFr: tpl.subjectFr, bodyEn: tpl.bodyEn, bodyFr: tpl.bodyFr },
    })
    flash()
  }
  catch (e) { fail(e) }
}

async function sendNow(tpl: Template) {
  if (!confirm(t('admin.notifications.sendConfirm'))) return
  sendingKey.value = tpl.key
  error.value = ''
  try {
    const res = await $fetch<{ status: string, recipientCount: number }>('/api/admin/email-send', {
      method: 'POST',
      body: { templateKey: tpl.key },
    })
    saved.value = false
    await refreshLog()
    // Surface a quick result line via the saved banner area.
    sendResult.value = t('admin.notifications.sendResult', { count: res.recipientCount, status: res.status })
  }
  catch (e) { fail(e) }
  finally { sendingKey.value = '' }
}

// New schedule form.
const newSchedule = reactive({ templateKey: '', dayOfWeek: 0, timeOfDay: '09:00' })
watchEffect(() => {
  if (!newSchedule.templateKey && templates.value[0]) newSchedule.templateKey = templates.value[0].key
})

async function addSchedule() {
  if (!newSchedule.templateKey) return
  error.value = ''
  try {
    await $fetch('/api/admin/email-schedules', { method: 'POST', body: { ...newSchedule, active: true } })
    await refreshSchedules()
  }
  catch (e) { fail(e) }
}

async function patchSchedule(s: Schedule, patch: Partial<Schedule>) {
  error.value = ''
  try {
    await $fetch(`/api/admin/email-schedules/${s.id}`, { method: 'PATCH', body: patch })
    await refreshSchedules()
  }
  catch (e) { fail(e) }
}

async function removeSchedule(id: string) {
  error.value = ''
  try {
    await $fetch(`/api/admin/email-schedules/${id}`, { method: 'DELETE' })
    await refreshSchedules()
  }
  catch (e) { fail(e) }
}

function statusLabel(s: LogRow['status']) {
  return t(`admin.notifications.status${s.charAt(0).toUpperCase()}${s.slice(1)}`)
}
function triggerLabel(tr: LogRow['trigger']) {
  return t(`admin.notifications.trigger${tr.charAt(0).toUpperCase()}${tr.slice(1)}`)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(locale.value === 'fr' ? 'fr-CA' : 'en-CA')
}

const inputClass = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

useHead(() => ({ title: t('admin.notifications.title') }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight">
      {{ t('admin.notifications.title') }}
    </h1>
    <p class="mt-2 text-sm text-muted-foreground">
      {{ t('admin.notifications.intro') }}
    </p>

    <!-- Not-configured warning -->
    <div
      v-if="!configured"
      class="mt-6 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <TriangleAlert class="mt-0.5 size-4 shrink-0" />
      <div>
        {{ t('admin.notifications.notConfigured') }}
        <NuxtLink
          :to="localePath('/admin/settings')"
          class="font-medium underline"
        >{{ t('admin.notifications.configureLink') }}</NuxtLink>
      </div>
    </div>

    <!-- Feedback -->
    <div
      v-if="saved"
      class="mt-6 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
    >
      <Check class="size-4" /> {{ t('admin.saved') }}
    </div>
    <div
      v-else-if="sendResult"
      class="mt-6 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
    >
      <Send class="size-4" /> {{ sendResult }}
    </div>
    <div
      v-else-if="error"
      class="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {{ error }}
    </div>

    <!-- Templates -->
    <section class="mt-8">
      <h2 class="text-xl font-semibold">
        {{ t('admin.notifications.templates') }}
      </h2>
      <div class="mt-4 space-y-4">
        <Card
          v-for="tpl in templates"
          :key="tpl.id"
        >
          <CardHeader>
            <CardTitle class="text-base">
              {{ locale === 'fr' ? tpl.descriptionFr : tpl.descriptionEn }}
            </CardTitle>
            <p class="text-xs text-muted-foreground">
              {{ t('admin.notifications.placeholders') }}
            </p>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label :for="`se-${tpl.id}`">{{ t('admin.notifications.subjectEn') }}</Label>
                <Input
                  :id="`se-${tpl.id}`"
                  v-model="tpl.subjectEn"
                />
              </div>
              <div class="space-y-1.5">
                <Label :for="`sf-${tpl.id}`">{{ t('admin.notifications.subjectFr') }}</Label>
                <Input
                  :id="`sf-${tpl.id}`"
                  v-model="tpl.subjectFr"
                />
              </div>
              <div class="space-y-1.5">
                <Label :for="`be-${tpl.id}`">{{ t('admin.notifications.bodyEn') }}</Label>
                <textarea
                  :id="`be-${tpl.id}`"
                  v-model="tpl.bodyEn"
                  rows="5"
                  :class="inputClass"
                />
              </div>
              <div class="space-y-1.5">
                <Label :for="`bf-${tpl.id}`">{{ t('admin.notifications.bodyFr') }}</Label>
                <textarea
                  :id="`bf-${tpl.id}`"
                  v-model="tpl.bodyFr"
                  rows="5"
                  :class="inputClass"
                />
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                @click="saveTemplate(tpl)"
              >
                {{ t('admin.save') }}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                :disabled="sendingKey === tpl.key"
                @click="sendNow(tpl)"
              >
                <Send class="size-4" />
                {{ sendingKey === tpl.key ? t('admin.notifications.sending') : t('admin.notifications.sendNow') }}
              </Button>
              <span class="text-xs text-muted-foreground">{{ localizedSubject(tpl) }}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>

    <!-- Schedules -->
    <section class="mt-10">
      <h2 class="text-xl font-semibold">
        {{ t('admin.notifications.schedules') }}
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t('admin.notifications.schedulesIntro') }}
      </p>

      <div class="mt-4 space-y-3">
        <Card
          v-for="s in schedules"
          :key="s.id"
          :class="s.active ? '' : 'opacity-60'"
        >
          <CardContent class="flex flex-wrap items-end gap-3 py-4">
            <div class="min-w-40 flex-1 space-y-1.5">
              <Label>{{ t('admin.notifications.template') }}</Label>
              <select
                :value="s.templateKey"
                :class="inputClass"
                @change="patchSchedule(s, { templateKey: ($event.target as HTMLSelectElement).value })"
              >
                <option
                  v-for="tpl in templates"
                  :key="tpl.key"
                  :value="tpl.key"
                >
                  {{ locale === 'fr' ? tpl.descriptionFr : tpl.descriptionEn }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label>{{ t('admin.notifications.day') }}</Label>
              <select
                :value="s.dayOfWeek"
                :class="inputClass"
                @change="patchSchedule(s, { dayOfWeek: Number(($event.target as HTMLSelectElement).value) })"
              >
                <option
                  v-for="(name, i) in dayNames"
                  :key="i"
                  :value="i"
                >
                  {{ name }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label>{{ t('admin.notifications.time') }}</Label>
              <input
                type="time"
                :value="s.timeOfDay"
                :class="inputClass"
                @change="patchSchedule(s, { timeOfDay: ($event.target as HTMLInputElement).value })"
              >
            </div>
            <div class="flex items-center gap-2 pb-2">
              <input
                :id="`active-${s.id}`"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
                :checked="s.active"
                @change="patchSchedule(s, { active: ($event.target as HTMLInputElement).checked })"
              >
              <Label
                :for="`active-${s.id}`"
                class="font-normal"
              >{{ t('admin.notifications.active') }}</Label>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="text-muted-foreground hover:text-destructive"
              :aria-label="t('admin.notifications.deleteSchedule')"
              @click="removeSchedule(s.id)"
            >
              <Trash2 class="size-4" />
            </Button>
          </CardContent>
        </Card>

        <p
          v-if="schedules.length === 0"
          class="text-sm text-muted-foreground"
        >
          {{ t('admin.notifications.noSchedules') }}
        </p>
      </div>

      <!-- Add schedule -->
      <Card class="mt-4 border-dashed">
        <CardHeader>
          <CardTitle class="text-base">
            {{ t('admin.notifications.addSchedule') }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            class="flex flex-wrap items-end gap-3"
            @submit.prevent="addSchedule"
          >
            <div class="min-w-40 flex-1 space-y-1.5">
              <Label>{{ t('admin.notifications.template') }}</Label>
              <select
                v-model="newSchedule.templateKey"
                :class="inputClass"
              >
                <option
                  v-for="tpl in templates"
                  :key="tpl.key"
                  :value="tpl.key"
                >
                  {{ locale === 'fr' ? tpl.descriptionFr : tpl.descriptionEn }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label>{{ t('admin.notifications.day') }}</Label>
              <select
                v-model.number="newSchedule.dayOfWeek"
                :class="inputClass"
              >
                <option
                  v-for="(name, i) in dayNames"
                  :key="i"
                  :value="i"
                >
                  {{ name }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label>{{ t('admin.notifications.time') }}</Label>
              <input
                v-model="newSchedule.timeOfDay"
                type="time"
                :class="inputClass"
              >
            </div>
            <Button
              type="submit"
              variant="secondary"
            >
              <Plus class="size-4" />
              {{ t('admin.notifications.addSchedule') }}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>

    <!-- Send log -->
    <section class="mt-10">
      <h2 class="text-xl font-semibold">
        {{ t('admin.notifications.log') }}
      </h2>
      <div class="mt-4 overflow-x-auto">
        <table
          v-if="log.length"
          class="w-full text-sm"
        >
          <thead class="text-left text-xs text-muted-foreground">
            <tr class="border-b">
              <th class="py-2 pr-4 font-medium">
                {{ t('admin.notifications.colWhen') }}
              </th>
              <th class="py-2 pr-4 font-medium">
                {{ t('admin.notifications.colTemplate') }}
              </th>
              <th class="py-2 pr-4 font-medium">
                {{ t('admin.notifications.colTrigger') }}
              </th>
              <th class="py-2 pr-4 font-medium">
                {{ t('admin.notifications.colStatus') }}
              </th>
              <th class="py-2 pr-4 font-medium">
                {{ t('admin.notifications.colRecipients') }}
              </th>
              <th class="py-2 pr-4 font-medium">
                {{ t('admin.notifications.colBy') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in log"
              :key="row.id"
              class="border-b last:border-0"
            >
              <td class="py-2 pr-4 whitespace-nowrap">
                {{ fmtDate(row.sentAt) }}
              </td>
              <td class="py-2 pr-4">
                {{ row.templateKey }}
              </td>
              <td class="py-2 pr-4">
                {{ triggerLabel(row.trigger) }}
              </td>
              <td class="py-2 pr-4">
                {{ statusLabel(row.status) }}
              </td>
              <td class="py-2 pr-4">
                {{ row.recipientCount }}
              </td>
              <td class="py-2 pr-4">
                {{ row.triggeredByName ?? '—' }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-else
          class="text-sm text-muted-foreground"
        >
          {{ t('admin.notifications.noLog') }}
        </p>
      </div>
    </section>
  </div>
</template>
