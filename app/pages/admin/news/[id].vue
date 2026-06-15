<script setup lang="ts">
import { ArrowLeft, Check, ImageUp, Loader2, Trash2 } from '@lucide/vue'

// News article editor (issue #12). Content-edit gated client- and server-side.
// Bilingual: EN/FR title + excerpt + Editor.js body. Publishing requires both
// locales complete (enforced by the publish endpoint, surfaced here).
definePageMeta({ middleware: 'content' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

interface Article {
  id: string
  titleEn: string
  titleFr: string
  contentEn: string
  contentFr: string
  excerptEn: string | null
  excerptFr: string | null
  image: string | null
  publishedAt: string | null
}

const { data, error: fetchError } = await useFetch<{ article: Article }>(
  () => `/api/admin/news/${route.params.id}`,
  { key: `admin-news-${route.params.id}` },
)
if (fetchError.value || !data.value?.article) {
  throw createError({ statusCode: 404, statusMessage: t('news.notFound'), fatal: true })
}

const a = data.value.article
const form = reactive({
  titleEn: a.titleEn,
  titleFr: a.titleFr,
  contentEn: a.contentEn,
  contentFr: a.contentFr,
  excerptEn: a.excerptEn ?? '',
  excerptFr: a.excerptFr ?? '',
  image: a.image ?? '',
})
const publishedAt = ref<string | null>(a.publishedAt)

const tab = ref<'en' | 'fr'>('en')
const saving = ref(false)
const saved = ref(false)
const publishing = ref(false)
const uploading = ref(false)
const error = ref('')
const missing = ref<string[]>([])

async function save() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    await $fetch(`/api/admin/news/${route.params.id}`, { method: 'PATCH', body: { ...form } })
    saved.value = true
    setTimeout(() => (saved.value = false), 1500)
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.genericError'))
  }
  finally {
    saving.value = false
  }
}

async function togglePublish() {
  publishing.value = true
  error.value = ''
  missing.value = []
  try {
    // Save first so publish validates the latest content.
    await $fetch(`/api/admin/news/${route.params.id}`, { method: 'PATCH', body: { ...form } })
    const action = publishedAt.value ? 'unpublish' : 'publish'
    const { article } = await $fetch<{ article: Article }>(
      `/api/admin/news/${route.params.id}/${action}`,
      { method: 'POST' },
    )
    publishedAt.value = article.publishedAt
  }
  catch (e) {
    const data = (e as { data?: { data?: { missing?: string[] } } })?.data?.data
    if (data?.missing) missing.value = data.missing
    error.value = errorMessage(e, t('admin.news.publishBlocked'))
  }
  finally {
    publishing.value = false
  }
}

async function onPickCover(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  error.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await $fetch<{ url: string }>('/api/uploads', { method: 'POST', body: fd })
    form.image = res.url
  }
  catch (e) {
    error.value = errorMessage(e, t('admin.uploads.error'))
  }
  finally {
    uploading.value = false
  }
}

function fieldMissing(field: string) {
  return missing.value.includes(field)
}

useHead(() => ({ title: t('admin.news.editTitle') }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <Button
      as-child
      variant="ghost"
      size="sm"
      class="mb-6 -ml-2"
    >
      <NuxtLink :to="localePath('/admin/news')">
        <ArrowLeft class="size-4" />
        {{ t('admin.news.backToList') }}
      </NuxtLink>
    </Button>

    <header class="mb-6 flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold tracking-tight">
        {{ t('admin.news.editTitle') }}
      </h1>
      <Badge :variant="publishedAt ? 'default' : 'secondary'">
        {{ publishedAt ? t('admin.news.published') : t('admin.news.draft') }}
      </Badge>
    </header>

    <!-- Language tabs: both locales stay mounted so editor state is preserved. -->
    <div class="mb-6 inline-flex rounded-md border p-1">
      <button
        v-for="loc in (['en', 'fr'] as const)"
        :key="loc"
        type="button"
        class="rounded px-4 py-1.5 text-sm font-medium transition-colors"
        :class="tab === loc ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
        @click="tab = loc"
      >
        {{ loc === 'en' ? t('admin.news.english') : t('admin.news.french') }}
      </button>
    </div>

    <div class="space-y-6">
      <!-- English fields -->
      <div
        v-show="tab === 'en'"
        class="space-y-4"
      >
        <div class="space-y-2">
          <Label for="titleEn">
            {{ t('admin.news.titleField') }}
            <span
              v-if="fieldMissing('titleEn')"
              class="text-destructive"
            >*</span>
          </Label>
          <Input
            id="titleEn"
            v-model="form.titleEn"
          />
        </div>
        <div class="space-y-2">
          <Label for="excerptEn">{{ t('admin.news.excerpt') }}</Label>
          <textarea
            id="excerptEn"
            v-model="form.excerptEn"
            rows="2"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div class="space-y-2">
          <Label>
            {{ t('admin.news.body') }}
            <span
              v-if="fieldMissing('contentEn')"
              class="text-destructive"
            >*</span>
          </Label>
          <NewsEditor
            v-model="form.contentEn"
            :placeholder="t('admin.news.bodyPlaceholder')"
          />
        </div>
      </div>

      <!-- French fields -->
      <div
        v-show="tab === 'fr'"
        class="space-y-4"
      >
        <div class="space-y-2">
          <Label for="titleFr">
            {{ t('admin.news.titleField') }}
            <span
              v-if="fieldMissing('titleFr')"
              class="text-destructive"
            >*</span>
          </Label>
          <Input
            id="titleFr"
            v-model="form.titleFr"
          />
        </div>
        <div class="space-y-2">
          <Label for="excerptFr">{{ t('admin.news.excerpt') }}</Label>
          <textarea
            id="excerptFr"
            v-model="form.excerptFr"
            rows="2"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div class="space-y-2">
          <Label>
            {{ t('admin.news.body') }}
            <span
              v-if="fieldMissing('contentFr')"
              class="text-destructive"
            >*</span>
          </Label>
          <NewsEditor
            v-model="form.contentFr"
            :placeholder="t('admin.news.bodyPlaceholder')"
          />
        </div>
      </div>

      <!-- Cover image (shared across locales) -->
      <div class="space-y-2">
        <Label>{{ t('admin.news.cover') }}</Label>
        <div class="flex items-center gap-4">
          <img
            v-if="form.image"
            :src="form.image"
            alt=""
            class="h-20 w-32 rounded border object-cover"
          >
          <div class="flex items-center gap-2">
            <Button
              as="label"
              variant="outline"
              size="sm"
              :disabled="uploading"
            >
              <component
                :is="uploading ? Loader2 : ImageUp"
                class="size-4"
                :class="uploading && 'animate-spin'"
              />
              {{ form.image ? t('admin.news.replaceCover') : t('admin.news.uploadCover') }}
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="onPickCover"
              >
            </Button>
            <Button
              v-if="form.image"
              variant="ghost"
              size="sm"
              class="text-destructive"
              @click="form.image = ''"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <p
        v-if="error"
        class="text-sm text-destructive"
      >
        {{ error }}
      </p>

      <div class="flex items-center gap-3 border-t pt-4">
        <Button
          :disabled="saving"
          @click="save"
        >
          <Check
            v-if="saved"
            class="size-4"
          />
          {{ saved ? t('admin.news.saved') : (saving ? t('admin.saving') : t('admin.news.saveChanges')) }}
        </Button>
        <Button
          variant="secondary"
          :disabled="publishing"
          @click="togglePublish"
        >
          {{ publishedAt ? t('admin.news.unpublish') : t('admin.news.publish') }}
        </Button>
      </div>
    </div>
  </div>
</template>
