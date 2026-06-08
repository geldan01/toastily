<script setup lang="ts">
import { CalendarOff, CalendarPlus, Plus, RotateCcw, Trash2, XCircle } from '@lucide/vue'

definePageMeta({ middleware: 'calendar' })

interface MeetingRow { id: string, date: string, meetingNumber: number | null, status: 'scheduled' | 'cancelled', themeEn: string | null, themeFr: string | null, location: string | null }
interface HolidayRow { id: string, date: string, labelEn: string, labelFr: string }

const { locale, t } = useI18n()
const localePath = useLocalePath()
const { setting } = useSettings()

const { data, refresh } = await useFetch<{ meetings: MeetingRow[], holidays: HolidayRow[] }>('/api/meetings', { key: 'admin-meetings-list' })

const error = ref('')
const meetingForm = reactive({ date: '', themeEn: '', themeFr: '', location: '' })
const holidayForm = reactive({ date: '', labelEn: '', labelFr: '' })

// "Generate the Toastmaster year" — default to the upcoming Jul 1 → Jun 30 span.
function nextJulyFirst() {
  const now = new Date()
  const y = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
  return `${y}-07-01`
}
function plusYearMinusDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y! + 1, m! - 1, d!))
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}
const genStart = nextJulyFirst()
const genForm = reactive({
  firstDate: genStart,
  untilDate: plusYearMinusDay(genStart),
  everyWeeks: Number(setting('meeting.frequency_weeks', '1')) || 1,
  location: '',
  numberStart: setting('meeting.number_start', ''),
})
const generating = ref(false)
const genResult = ref('')

async function generateYear() {
  if (!genForm.firstDate || !genForm.untilDate) return
  generating.value = true
  error.value = ''
  genResult.value = ''
  try {
    const r = await $fetch<{ created: number, skippedHoliday: number, skippedExisting: number }>('/api/admin/meetings/generate', { method: 'POST', body: { ...genForm } })
    genResult.value = t('admin.meetings.genResult', { created: r.created, holiday: r.skippedHoliday, existing: r.skippedExisting })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { generating.value = false }
}

async function setStatus(id: string, status: 'scheduled' | 'cancelled') {
  error.value = ''
  try {
    await $fetch(`/api/admin/meetings/${id}`, { method: 'PATCH', body: { status } })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
}

function fmt(iso: string) {
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${iso}T00:00:00`))
}

async function createMeeting() {
  if (!meetingForm.date) return
  error.value = ''
  try {
    await $fetch('/api/admin/meetings', { method: 'POST', body: { ...meetingForm } })
    Object.assign(meetingForm, { date: '', themeEn: '', themeFr: '', location: '' })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
}

async function deleteMeeting(id: string) {
  error.value = ''
  try {
    await $fetch(`/api/admin/meetings/${id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
}

async function addHoliday() {
  if (!holidayForm.date || !holidayForm.labelEn.trim() || !holidayForm.labelFr.trim()) return
  error.value = ''
  try {
    await $fetch('/api/admin/holidays', { method: 'POST', body: { ...holidayForm } })
    Object.assign(holidayForm, { date: '', labelEn: '', labelFr: '' })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
}

async function deleteHoliday(id: string) {
  error.value = ''
  try {
    await $fetch(`/api/admin/holidays/${id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
}

useHead(() => ({ title: t('admin.meetings.title') }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight">
      {{ t('admin.meetings.title') }}
    </h1>
    <p class="mt-2 text-sm text-muted-foreground">
      {{ t('admin.meetings.intro') }}
    </p>

    <div
      v-if="error"
      class="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {{ error }}
    </div>

    <!-- Generate the Toastmaster year -->
    <Card class="mt-8 border-secondary/40">
      <CardHeader>
        <CardTitle class="text-lg">
          {{ t('admin.meetings.generateTitle') }}
        </CardTitle>
        <p class="text-sm text-muted-foreground">
          {{ t('admin.meetings.generateIntro') }}
        </p>
      </CardHeader>
      <CardContent>
        <form
          class="grid gap-4 sm:grid-cols-2"
          @submit.prevent="generateYear"
        >
          <div class="space-y-1.5">
            <Label for="g-first">{{ t('admin.meetings.firstDate') }}</Label>
            <Input
              id="g-first"
              v-model="genForm.firstDate"
              type="date"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="g-until">{{ t('admin.meetings.untilDate') }}</Label>
            <Input
              id="g-until"
              v-model="genForm.untilDate"
              type="date"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="g-every">{{ t('admin.meetings.everyWeeks') }}</Label>
            <Input
              id="g-every"
              v-model.number="genForm.everyWeeks"
              type="number"
              min="1"
              max="8"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="g-num">{{ t('admin.meetings.numberStart') }}</Label>
            <Input
              id="g-num"
              v-model="genForm.numberStart"
              type="number"
              min="1"
              :placeholder="t('admin.meetings.numberStartHint')"
            />
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label for="g-loc">{{ t('admin.meetings.location') }}</Label>
            <Input
              id="g-loc"
              v-model="genForm.location"
            />
          </div>
          <div class="flex items-center gap-3 sm:col-span-2">
            <Button
              type="submit"
              :disabled="generating || !genForm.firstDate || !genForm.untilDate"
            >
              <CalendarPlus class="size-4" />
              {{ generating ? t('admin.meetings.generating') : t('admin.meetings.generate2') }}
            </Button>
            <span
              v-if="genResult"
              class="text-sm font-medium text-emerald-700"
            >{{ genResult }}</span>
          </div>
        </form>
      </CardContent>
    </Card>

    <!-- New meeting -->
    <Card class="mt-6">
      <CardHeader>
        <CardTitle class="text-lg">
          {{ t('admin.meetings.newMeeting') }}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          class="grid gap-4 sm:grid-cols-2"
          @submit.prevent="createMeeting"
        >
          <div class="space-y-1.5">
            <Label for="m-date">{{ t('admin.meetings.date') }}</Label>
            <Input
              id="m-date"
              v-model="meetingForm.date"
              type="date"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="m-loc">{{ t('admin.meetings.location') }}</Label>
            <Input
              id="m-loc"
              v-model="meetingForm.location"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="m-ten">{{ t('admin.meetings.themeEn') }}</Label>
            <Input
              id="m-ten"
              v-model="meetingForm.themeEn"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="m-tfr">{{ t('admin.meetings.themeFr') }}</Label>
            <Input
              id="m-tfr"
              v-model="meetingForm.themeFr"
            />
          </div>
          <div class="sm:col-span-2">
            <Button
              type="submit"
              :disabled="!meetingForm.date"
            >
              <Plus class="size-4" />
              {{ t('admin.meetings.create') }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <!-- Existing meetings -->
    <h2 class="mt-8 text-lg font-semibold">
      {{ t('admin.meetings.existing') }}
    </h2>
    <ul class="mt-3 divide-y divide-border rounded-lg border border-border">
      <li
        v-for="m in data?.meetings ?? []"
        :key="m.id"
        class="flex items-center justify-between gap-3 px-4 py-3"
      >
        <NuxtLink
          :to="localePath(`/meeting/${m.date}`)"
          class="min-w-0 hover:underline"
          :class="m.status === 'cancelled' ? 'text-muted-foreground line-through' : ''"
        >
          <span
            v-if="m.meetingNumber != null"
            class="mr-1 inline-block rounded bg-muted px-1.5 text-xs font-semibold text-muted-foreground no-underline"
          >#{{ m.meetingNumber }}</span>
          <span class="font-medium">{{ fmt(m.date) }}</span>
          <span class="text-muted-foreground"> — {{ (locale === 'fr' ? m.themeFr : m.themeEn) || t('meetings.untitled') }}</span>
          <span
            v-if="m.status === 'cancelled'"
            class="ml-1 text-xs font-medium text-destructive no-underline"
          >({{ t('admin.meetings.cancelled') }})</span>
        </NuxtLink>
        <div class="flex shrink-0 items-center gap-1">
          <Button
            v-if="m.status === 'scheduled'"
            variant="ghost"
            size="sm"
            class="text-muted-foreground hover:text-destructive"
            @click="setStatus(m.id, 'cancelled')"
          >
            <XCircle class="size-4" /> {{ t('admin.meetings.cancel') }}
          </Button>
          <Button
            v-else
            variant="ghost"
            size="sm"
            @click="setStatus(m.id, 'scheduled')"
          >
            <RotateCcw class="size-4" /> {{ t('admin.meetings.restore') }}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="text-muted-foreground hover:text-destructive"
            :aria-label="t('admin.meetings.delete')"
            @click="deleteMeeting(m.id)"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>
      </li>
      <li
        v-if="!(data?.meetings ?? []).length"
        class="px-4 py-3 text-sm text-muted-foreground"
      >
        {{ t('admin.meetings.none') }}
      </li>
    </ul>

    <!-- Holidays -->
    <h2 class="mt-10 text-lg font-semibold">
      {{ t('admin.meetings.holidaysTitle') }}
    </h2>
    <p class="mt-1 text-sm text-muted-foreground">
      {{ t('admin.meetings.holidaysIntro') }}
    </p>
    <Card class="mt-3 border-dashed">
      <CardContent class="py-4">
        <form
          class="grid gap-3 sm:grid-cols-3"
          @submit.prevent="addHoliday"
        >
          <div class="space-y-1.5">
            <Label for="h-date">{{ t('admin.meetings.date') }}</Label>
            <Input
              id="h-date"
              v-model="holidayForm.date"
              type="date"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="h-en">{{ t('admin.meetings.labelEn') }}</Label>
            <Input
              id="h-en"
              v-model="holidayForm.labelEn"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="h-fr">{{ t('admin.meetings.labelFr') }}</Label>
            <Input
              id="h-fr"
              v-model="holidayForm.labelFr"
            />
          </div>
          <div class="sm:col-span-3">
            <Button
              type="submit"
              variant="secondary"
              :disabled="!holidayForm.date || !holidayForm.labelEn.trim() || !holidayForm.labelFr.trim()"
            >
              <CalendarOff class="size-4" />
              {{ t('admin.meetings.addHoliday') }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
    <ul class="mt-3 divide-y divide-border rounded-lg border border-border">
      <li
        v-for="h in data?.holidays ?? []"
        :key="h.id"
        class="flex items-center justify-between gap-3 px-4 py-3"
      >
        <span>
          <span class="font-medium">{{ fmt(h.date) }}</span>
          <span class="text-muted-foreground"> — {{ locale === 'fr' ? h.labelFr : h.labelEn }}</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          class="text-muted-foreground hover:text-destructive"
          :aria-label="t('admin.meetings.delete')"
          @click="deleteHoliday(h.id)"
        >
          <Trash2 class="size-4" />
        </Button>
      </li>
      <li
        v-if="!(data?.holidays ?? []).length"
        class="px-4 py-3 text-sm text-muted-foreground"
      >
        {{ t('admin.meetings.noHolidays') }}
      </li>
    </ul>
  </div>
</template>
