<script setup lang="ts">
import { CheckCircle2, Info, Link2, Pencil, Plus, Route, Trash2 } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

type Project = {
  id: string
  level: number
  title: string
  completedAt: string | null
  speechId: string | null
  speechDate: string | null
  speechTitle: string | null
}
type Enrollment = {
  id: string
  pathId: string
  pathNameEn: string
  pathNameFr: string
  isCurrent: boolean
  startedAt: string | null
  completedAt: string | null
  projects: Project[]
}
type Speech = { id: string, date: string, title: string | null, slot: number }
type Tracker = {
  paths: { id: string, nameEn: string, nameFr: string }[]
  enrollments: Enrollment[]
  speeches: Speech[]
}

const { data, refresh } = await useFetch<Tracker>('/api/pathways', {
  key: 'my-pathways',
  default: () => ({ paths: [], enrollments: [] as Enrollment[], speeches: [] as Speech[] }),
})

const enrollments = computed(() => data.value?.enrollments ?? [])
const speeches = computed(() => data.value?.speeches ?? [])
const LEVELS = [1, 2, 3, 4, 5]

// Paths not yet enrolled — the only ones offered in the add-path picker.
const availablePaths = computed(() => {
  const taken = new Set(enrollments.value.map(e => e.pathId))
  return (data.value?.paths ?? []).filter(p => !taken.has(p.id))
})

const pathName = (p: { nameEn: string, nameFr: string }) => (locale.value === 'fr' ? p.nameFr : p.nameEn)
const enrollmentName = (e: Enrollment) => (locale.value === 'fr' ? e.pathNameFr : e.pathNameEn)

function fmtDate(date: string) {
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}
function speechLabel(s: Speech) {
  return `${fmtDate(s.date)} — ${s.title || t('pathways.untitledSpeech')}`
}

const error = ref('')
async function run(fn: () => Promise<unknown>) {
  error.value = ''
  try {
    await fn()
    await refresh()
  }
  catch (e) {
    error.value = errorMessage(e, t('pathways.error'))
  }
}

// --- Add a path ---
const newPathId = ref('')
async function addPath() {
  if (!newPathId.value) return
  await run(async () => {
    await $fetch('/api/pathways/enrollments', { method: 'POST', body: { pathId: newPathId.value } })
    newPathId.value = ''
  })
}

// --- Enrollment actions ---
const makeCurrent = (e: Enrollment) => run(() => $fetch(`/api/pathways/enrollments/${e.id}`, { method: 'PATCH', body: { isCurrent: true } }))
const toggleCompleted = (e: Enrollment) => run(() => $fetch(`/api/pathways/enrollments/${e.id}`, {
  method: 'PATCH',
  body: { completedAt: e.completedAt ? null : new Date().toISOString().slice(0, 10) },
}))
async function removePath(e: Enrollment) {
  if (!window.confirm(t('pathways.confirmRemovePath'))) return
  await run(() => $fetch(`/api/pathways/enrollments/${e.id}`, { method: 'DELETE' }))
}

// --- Project add/edit form (one open editor at a time) ---
type ProjectForm = { enrollmentId: string, projectId: string | null, level: number, title: string, completedAt: string, speechId: string }
const form = ref<ProjectForm | null>(null)

function openAdd(e: Enrollment) {
  form.value = { enrollmentId: e.id, projectId: null, level: 1, title: '', completedAt: '', speechId: '' }
}
function openEdit(e: Enrollment, p: Project) {
  form.value = { enrollmentId: e.id, projectId: p.id, level: p.level, title: p.title, completedAt: p.completedAt ?? '', speechId: p.speechId ?? '' }
}
function closeForm() {
  form.value = null
}

async function saveProject() {
  const f = form.value
  if (!f || !f.title.trim()) return
  const body = {
    enrollmentId: f.enrollmentId,
    level: f.level,
    title: f.title.trim(),
    completedAt: f.completedAt || null,
    speechId: f.speechId || null,
  }
  await run(async () => {
    if (f.projectId) await $fetch(`/api/pathways/projects/${f.projectId}`, { method: 'PATCH', body })
    else await $fetch('/api/pathways/projects', { method: 'POST', body })
    closeForm()
  })
}

async function removeProject(p: Project) {
  if (!window.confirm(t('pathways.confirmRemoveProject'))) return
  await run(() => $fetch(`/api/pathways/projects/${p.id}`, { method: 'DELETE' }))
}

const projectsByLevel = (e: Enrollment) => LEVELS
  .map(level => ({ level, items: e.projects.filter(p => p.level === level) }))
  .filter(g => g.items.length > 0)

useHead(() => ({ title: t('pathways.title') }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <header class="mb-6">
      <h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight">
        <Route class="size-7" /> {{ t('pathways.title') }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('pathways.subtitle') }}
      </p>
    </header>

    <!-- Base Camp caveat (prominent, per issue #58) -->
    <div class="mb-8 flex gap-3 rounded-lg border border-secondary/40 bg-secondary/5 px-4 py-3">
      <Info class="mt-0.5 size-5 shrink-0 text-secondary" />
      <div>
        <p class="font-semibold">
          {{ t('pathways.baseCampTitle') }}
        </p>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t('pathways.baseCampBody') }}
        </p>
      </div>
    </div>

    <p
      v-if="error"
      class="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </p>

    <!-- Add a path -->
    <div
      v-if="availablePaths.length"
      class="mb-8 flex flex-wrap items-end gap-2"
    >
      <div class="grow">
        <Label
          for="add-path"
          class="mb-1.5 block text-sm font-medium"
        >{{ t('pathways.addPath') }}</Label>
        <select
          id="add-path"
          v-model="newPathId"
          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          <option value="">
            {{ t('pathways.choosePath') }}
          </option>
          <option
            v-for="p in availablePaths"
            :key="p.id"
            :value="p.id"
          >
            {{ pathName(p) }}
          </option>
        </select>
      </div>
      <Button
        :disabled="!newPathId"
        @click="addPath"
      >
        <Plus class="size-4" /> {{ t('pathways.startTracking') }}
      </Button>
    </div>

    <!-- Empty state -->
    <p
      v-if="!enrollments.length"
      class="rounded-lg border px-4 py-10 text-center text-muted-foreground"
    >
      {{ t('pathways.noEnrollments') }}
    </p>

    <!-- Enrollments -->
    <div
      v-else
      class="space-y-6"
    >
      <Card
        v-for="e in enrollments"
        :key="e.id"
        :class="e.isCurrent ? 'border-primary/50' : ''"
      >
        <CardHeader class="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div class="min-w-0">
            <CardTitle class="flex flex-wrap items-center gap-2 text-lg">
              {{ enrollmentName(e) }}
              <Badge
                v-if="e.isCurrent"
                variant="default"
              >
                {{ t('pathways.current') }}
              </Badge>
              <Badge
                v-if="e.completedAt"
                variant="secondary"
                class="gap-1"
              >
                <CheckCircle2 class="size-3" /> {{ t('pathways.completedBadge') }}
              </Badge>
            </CardTitle>
            <CardDescription class="mt-1 flex flex-wrap gap-x-3">
              <span v-if="e.startedAt">{{ t('pathways.startedOn', { date: fmtDate(e.startedAt) }) }}</span>
              <span v-if="e.completedAt">{{ t('pathways.completedOn', { date: fmtDate(e.completedAt) }) }}</span>
            </CardDescription>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            <Button
              v-if="!e.isCurrent"
              variant="outline"
              size="sm"
              @click="makeCurrent(e)"
            >
              {{ t('pathways.makeCurrent') }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              @click="toggleCompleted(e)"
            >
              {{ e.completedAt ? t('pathways.reopen') : t('pathways.markCompleted') }}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              :aria-label="t('pathways.removePath')"
              class="text-destructive hover:bg-destructive/10 hover:text-destructive"
              @click="removePath(e)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent class="space-y-4">
          <!-- Projects grouped by level -->
          <p
            v-if="!e.projects.length"
            class="text-sm text-muted-foreground"
          >
            {{ t('pathways.noProjects') }}
          </p>
          <div
            v-for="g in projectsByLevel(e)"
            :key="g.level"
          >
            <h3 class="mb-2 text-sm font-semibold text-secondary">
              {{ t('pathways.levelN', { n: g.level }) }}
            </h3>
            <ul class="space-y-2">
              <li
                v-for="p in g.items"
                :key="p.id"
                class="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div class="min-w-0">
                  <p class="font-medium">
                    {{ p.title }}
                  </p>
                  <p class="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span v-if="p.completedAt">{{ t('pathways.completedOn', { date: fmtDate(p.completedAt) }) }}</span>
                    <NuxtLink
                      v-if="p.speechId && p.speechDate"
                      :to="localePath(`/meeting/${p.speechDate}`)"
                      class="inline-flex items-center gap-1 hover:underline"
                    >
                      <Link2 class="size-3" />
                      {{ t('pathways.linkedSpeech') }}: {{ p.speechTitle || t('pathways.untitledSpeech') }}
                    </NuxtLink>
                  </p>
                </div>
                <div class="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-8"
                    :aria-label="t('pathways.edit')"
                    @click="openEdit(e, p)"
                  >
                    <Pencil class="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    :aria-label="t('pathways.remove')"
                    @click="removeProject(p)"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </li>
            </ul>
          </div>

          <!-- Add/edit project form (inline, one at a time) -->
          <div
            v-if="form && form.enrollmentId === e.id"
            class="space-y-3 rounded-md border bg-muted/30 p-3"
          >
            <div class="flex flex-wrap gap-3">
              <div class="w-24">
                <Label class="mb-1.5 block text-xs font-medium">{{ t('pathways.level') }}</Label>
                <select
                  v-model.number="form.level"
                  class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <option
                    v-for="l in LEVELS"
                    :key="l"
                    :value="l"
                  >
                    {{ l }}
                  </option>
                </select>
              </div>
              <div class="min-w-48 grow">
                <Label class="mb-1.5 block text-xs font-medium">{{ t('pathways.projectTitle') }}</Label>
                <Input
                  v-model="form.title"
                  :placeholder="t('pathways.projectTitlePlaceholder')"
                />
              </div>
            </div>
            <div class="flex flex-wrap gap-3">
              <div>
                <Label class="mb-1.5 block text-xs font-medium">{{ t('pathways.completedDate') }}</Label>
                <Input
                  v-model="form.completedAt"
                  type="date"
                  class="w-auto"
                />
              </div>
              <div class="min-w-48 grow">
                <Label class="mb-1.5 block text-xs font-medium">{{ t('pathways.linkSpeech') }}</Label>
                <select
                  v-model="form.speechId"
                  class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <option value="">
                    {{ t('pathways.noSpeech') }}
                  </option>
                  <option
                    v-for="s in speeches"
                    :key="s.id"
                    :value="s.id"
                  >
                    {{ speechLabel(s) }}
                  </option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                @click="closeForm"
              >
                {{ t('common.cancel') }}
              </Button>
              <Button
                size="sm"
                :disabled="!form.title.trim()"
                @click="saveProject"
              >
                {{ t('pathways.save') }}
              </Button>
            </div>
          </div>
          <Button
            v-else
            variant="outline"
            size="sm"
            @click="openAdd(e)"
          >
            <Plus class="size-4" /> {{ t('pathways.addProject') }}
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
