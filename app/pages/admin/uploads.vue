<script setup lang="ts">
import { ImageUp, Check, Copy, Trash2, RefreshCw } from '@lucide/vue'

// Media library for the §2/§15 image-upload backend (issue #78). Admin-only:
// lists every object in the bucket's uploads/ prefix annotated with where it's
// used (avatars, News, pages, content blocks), flags orphans, and allows
// deleting objects. Also keeps the original upload widget. The API enforces the
// admin gate independently; News / content editors drive the same POST endpoint.
definePageMeta({ middleware: 'admin' })

const { t, locale } = useI18n()

type UsageKind = 'avatar' | 'news' | 'page' | 'contentBlock'
interface Usage { kind: UsageKind, label: string, ref?: string }
interface StoredObject { key: string, url: string, size: number, lastModified: string | null, usage: Usage[] }

// --- Upload widget --------------------------------------------------------
const selected = ref<File | null>(null)
const uploading = ref(false)
const result = ref<{ key: string, url: string } | null>(null)
const uploadError = ref<string | null>(null)
const copiedUrl = ref<string | null>(null)

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  selected.value = input.files?.[0] ?? null
  result.value = null
  uploadError.value = null
}

async function upload() {
  if (!selected.value) return
  uploading.value = true
  uploadError.value = null
  result.value = null
  try {
    const fd = new FormData()
    fd.append('file', selected.value)
    result.value = await $fetch<{ key: string, url: string }>('/api/uploads', { method: 'POST', body: fd })
    await loadLibrary()
  }
  catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    const msg = (err as { statusMessage?: string })?.statusMessage
    uploadError.value = status === 503 ? t('admin.uploads.notConfigured') : (msg || t('admin.uploads.error'))
  }
  finally {
    uploading.value = false
  }
}

async function copyUrl(url: string) {
  await navigator.clipboard.writeText(url)
  copiedUrl.value = url
  setTimeout(() => {
    if (copiedUrl.value === url) copiedUrl.value = null
  }, 1500)
}

// --- Library --------------------------------------------------------------
const objects = ref<StoredObject[]>([])
const truncated = ref(false)
const loading = ref(true)
const notConfigured = ref(false)
const loadError = ref<string | null>(null)
const deleting = ref<string | null>(null)

async function loadLibrary() {
  loading.value = true
  loadError.value = null
  notConfigured.value = false
  try {
    const data = await $fetch<{ objects: StoredObject[], truncated: boolean }>('/api/uploads')
    objects.value = data.objects
    truncated.value = data.truncated
  }
  catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 503) notConfigured.value = true
    else loadError.value = t('admin.uploads.loadError')
  }
  finally {
    loading.value = false
  }
}

async function remove(obj: StoredObject) {
  const inUse = obj.usage.length > 0
  const msg = inUse ? t('admin.uploads.confirmDeleteInUse') : t('admin.uploads.confirmDelete')
  if (!confirm(msg)) return
  deleting.value = obj.key
  try {
    await $fetch('/api/uploads', {
      method: 'DELETE',
      query: { key: obj.key, ...(inUse ? { force: 'true' } : {}) },
    })
    objects.value = objects.value.filter(o => o.key !== obj.key)
  }
  catch {
    loadError.value = t('admin.uploads.deleteError')
  }
  finally {
    deleting.value = null
  }
}

const orphanCount = computed(() => objects.value.filter(o => o.usage.length === 0).length)
const totalBytes = computed(() => objects.value.reduce((sum, o) => sum + o.size, 0))

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' })
}

const usageVariant: Record<UsageKind, 'default' | 'secondary' | 'outline'> = {
  avatar: 'secondary',
  news: 'default',
  page: 'outline',
  contentBlock: 'outline',
}

onMounted(loadLibrary)

useHead(() => ({ title: t('admin.uploads.title') }))
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-12">
    <header class="mb-8">
      <h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight">
        <ImageUp class="size-7 text-primary" />
        {{ t('admin.uploads.title') }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('admin.uploads.intro') }}
      </p>
    </header>

    <!-- Upload widget -->
    <Card class="mb-8">
      <CardHeader>
        <CardTitle class="text-lg">
          {{ t('admin.uploads.uploadHeading') }}
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="file">{{ t('admin.uploads.choose') }}</Label>
          <input
            id="file"
            type="file"
            accept="image/*"
            class="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            @change="onPick"
          >
        </div>

        <Button
          :disabled="!selected || uploading"
          @click="upload"
        >
          {{ uploading ? t('admin.uploads.uploading') : t('admin.uploads.upload') }}
        </Button>

        <p
          v-if="uploadError"
          class="text-sm text-destructive"
        >
          {{ uploadError }}
        </p>

        <div
          v-if="result"
          class="flex items-center gap-2 rounded-md border p-3"
        >
          <code class="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{{ result.url }}</code>
          <Button
            size="sm"
            variant="outline"
            @click="copyUrl(result.url)"
          >
            <component
              :is="copiedUrl === result.url ? Check : Copy"
              class="size-4"
            />
            {{ copiedUrl === result.url ? t('admin.uploads.copied') : t('admin.uploads.copy') }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Library -->
    <section>
      <div class="mb-4 flex items-center justify-between gap-4">
        <h2 class="text-xl font-semibold">
          {{ t('admin.uploads.libraryHeading') }}
        </h2>
        <Button
          size="sm"
          variant="outline"
          :disabled="loading"
          @click="loadLibrary"
        >
          <RefreshCw
            class="size-4"
            :class="{ 'animate-spin': loading }"
          />
          {{ t('admin.uploads.refresh') }}
        </Button>
      </div>

      <p
        v-if="loading"
        class="text-sm text-muted-foreground"
      >
        {{ t('admin.uploads.loading') }}
      </p>

      <p
        v-else-if="notConfigured"
        class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
      >
        {{ t('admin.uploads.notConfigured') }}
      </p>

      <p
        v-else-if="loadError"
        class="text-sm text-destructive"
      >
        {{ loadError }}
      </p>

      <p
        v-else-if="objects.length === 0"
        class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
      >
        {{ t('admin.uploads.empty') }}
      </p>

      <template v-else>
        <p class="mb-4 text-sm text-muted-foreground">
          {{ t('admin.uploads.summary', { count: objects.length, orphans: orphanCount, size: formatBytes(totalBytes) }) }}
        </p>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="obj in objects"
            :key="obj.key"
            class="overflow-hidden"
          >
            <a
              :href="obj.url"
              target="_blank"
              rel="noopener"
              class="block aspect-video overflow-hidden bg-muted"
            >
              <img
                :src="obj.url"
                :alt="obj.key"
                loading="lazy"
                class="size-full object-contain"
              >
            </a>
            <CardContent class="space-y-3 pt-4">
              <div class="flex flex-wrap gap-1.5">
                <template v-if="obj.usage.length">
                  <Badge
                    v-for="(u, i) in obj.usage"
                    :key="i"
                    :variant="usageVariant[u.kind]"
                  >
                    {{ t(`admin.uploads.kind.${u.kind}`) }}: {{ u.label }}
                  </Badge>
                </template>
                <Badge
                  v-else
                  variant="destructive"
                >
                  {{ t('admin.uploads.unused') }}
                </Badge>
              </div>

              <p class="text-xs text-muted-foreground">
                {{ formatBytes(obj.size) }} · {{ formatDate(obj.lastModified) }}
              </p>

              <div class="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  class="flex-1"
                  @click="copyUrl(obj.url)"
                >
                  <component
                    :is="copiedUrl === obj.url ? Check : Copy"
                    class="size-4"
                  />
                  {{ copiedUrl === obj.url ? t('admin.uploads.copied') : t('admin.uploads.copy') }}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  class="text-destructive hover:text-destructive"
                  :disabled="deleting === obj.key"
                  :aria-label="t('admin.uploads.delete')"
                  @click="remove(obj)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <p
          v-if="truncated"
          class="mt-4 text-sm text-muted-foreground"
        >
          {{ t('admin.uploads.truncated') }}
        </p>
      </template>
    </section>
  </div>
</template>
