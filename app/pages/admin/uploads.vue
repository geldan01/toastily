<script setup lang="ts">
import { ImageUp, Check, Copy } from '@lucide/vue'

// Diagnostic widget for the §2/§15 image-upload backend (issue #10). Admin-only
// here; the API enforces the content-edit capability independently. The News /
// content-block editors will drive the same POST /api/uploads endpoint.
definePageMeta({ middleware: 'admin' })

const { t } = useI18n()

const fileInput = ref<HTMLInputElement | null>(null)
const selected = ref<File | null>(null)
const uploading = ref(false)
const result = ref<{ key: string, url: string } | null>(null)
const error = ref<string | null>(null)
const copied = ref(false)

// A bucket URL is absolute; the proxy fallback is a site-relative path.
const previewSrc = computed(() => result.value?.url ?? '')

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  selected.value = input.files?.[0] ?? null
  result.value = null
  error.value = null
}

async function upload() {
  if (!selected.value) return
  uploading.value = true
  error.value = null
  result.value = null
  try {
    const fd = new FormData()
    fd.append('file', selected.value)
    result.value = await $fetch<{ key: string, url: string }>('/api/uploads', { method: 'POST', body: fd })
  }
  catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    const msg = (err as { statusMessage?: string })?.statusMessage
    error.value = status === 503 ? t('admin.uploads.notConfigured') : (msg || t('admin.uploads.error'))
  }
  finally {
    uploading.value = false
  }
}

async function copyUrl() {
  if (!result.value) return
  await navigator.clipboard.writeText(result.value.url)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

useHead(() => ({ title: t('admin.uploads.title') }))
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12">
    <header class="mb-8">
      <h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight">
        <ImageUp class="size-7 text-primary" />
        {{ t('admin.uploads.title') }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('admin.uploads.intro') }}
      </p>
    </header>

    <Card>
      <CardContent class="space-y-4 pt-6">
        <div class="space-y-2">
          <Label for="file">{{ t('admin.uploads.choose') }}</Label>
          <input
            id="file"
            ref="fileInput"
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
          v-if="error"
          class="text-sm text-destructive"
        >
          {{ error }}
        </p>

        <div
          v-if="result"
          class="space-y-3 rounded-md border p-4"
        >
          <p class="text-sm font-medium">
            {{ t('admin.uploads.result') }}
          </p>
          <div class="flex items-center gap-2">
            <code class="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{{ result.url }}</code>
            <Button
              size="sm"
              variant="outline"
              @click="copyUrl"
            >
              <component
                :is="copied ? Check : Copy"
                class="size-4"
              />
              {{ copied ? t('admin.uploads.copied') : t('admin.uploads.copy') }}
            </Button>
          </div>
          <img
            :src="previewSrc"
            :alt="result.key"
            class="max-h-64 rounded border"
          >
        </div>
      </CardContent>
    </Card>
  </div>
</template>
