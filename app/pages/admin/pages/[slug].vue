<script setup lang="ts">
import { ArrowLeft, Check } from '@lucide/vue'

// Rich-page editor (issue #16): About / FAQ. Content-edit gated client- and
// server-side (the `content` middleware + requireContentManager). Bilingual:
// EN/FR title + Editor.js body. Publishing requires both locales complete,
// enforced by the PUT endpoint and surfaced here.
definePageMeta({ middleware: 'content' })

const PAGE_SLUGS = ['about', 'faq'] as const
type PageSlug = (typeof PAGE_SLUGS)[number]

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const slug = computed(() => route.params.slug as string)
if (!PAGE_SLUGS.includes(slug.value as PageSlug)) {
  throw createError({ statusCode: 404, statusMessage: t('pages.notFound'), fatal: true })
}

interface PageRow {
  slug: string
  titleEn: string | null
  titleFr: string | null
  contentEn: string | null
  contentFr: string | null
  published: boolean
}

const { data } = await useFetch<{ page: PageRow | null }>(
  () => `/api/admin/pages/${slug.value}`,
  { key: () => `admin-page-${slug.value}` },
)

const p = data.value?.page
const form = reactive({
  titleEn: p?.titleEn ?? '',
  titleFr: p?.titleFr ?? '',
  contentEn: p?.contentEn ?? '',
  contentFr: p?.contentFr ?? '',
})
const published = ref(p?.published ?? false)

const tab = ref<'en' | 'fr'>('en')
const saving = ref(false)
const saved = ref(false)
const publishing = ref(false)
const error = ref('')
const missing = ref<string[]>([])

async function put(wantPublished: boolean) {
  return await $fetch<{ page: PageRow }>(`/api/admin/pages/${slug.value}`, {
    method: 'PUT',
    body: { ...form, published: wantPublished },
  })
}

async function save() {
  saving.value = true
  saved.value = false
  error.value = ''
  missing.value = []
  try {
    // Saving never changes publish state; only the publish toggle does.
    await put(published.value)
    saved.value = true
    setTimeout(() => (saved.value = false), 1500)
  }
  catch (e) {
    const m = (e as { data?: { data?: { missing?: string[] } } })?.data?.data?.missing
    if (m) missing.value = m
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
    const { page } = await put(!published.value)
    published.value = page.published
  }
  catch (e) {
    const m = (e as { data?: { data?: { missing?: string[] } } })?.data?.data?.missing
    if (m) missing.value = m
    error.value = errorMessage(e, t('pages.publishBlocked'))
  }
  finally {
    publishing.value = false
  }
}

function fieldMissing(field: string) {
  return missing.value.includes(field)
}

useHead(() => ({ title: t('pages.editTitle') }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <Button
      as-child
      variant="ghost"
      size="sm"
      class="mb-6 -ml-2"
    >
      <NuxtLink :to="localePath(`/${slug}`)">
        <ArrowLeft class="size-4" />
        {{ t('pages.backToPage') }}
      </NuxtLink>
    </Button>

    <header class="mb-6 flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold tracking-tight">
        {{ t(`pages.${slug}`) }}
      </h1>
      <Badge :variant="published ? 'default' : 'secondary'">
        {{ published ? t('pages.published') : t('pages.draft') }}
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
        {{ loc === 'en' ? t('pages.english') : t('pages.french') }}
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
            {{ t('pages.titleField') }}
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
          <Label>
            {{ t('pages.body') }}
            <span
              v-if="fieldMissing('contentEn')"
              class="text-destructive"
            >*</span>
          </Label>
          <NewsEditor
            v-model="form.contentEn"
            :placeholder="t('pages.bodyPlaceholder')"
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
            {{ t('pages.titleField') }}
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
          <Label>
            {{ t('pages.body') }}
            <span
              v-if="fieldMissing('contentFr')"
              class="text-destructive"
            >*</span>
          </Label>
          <NewsEditor
            v-model="form.contentFr"
            :placeholder="t('pages.bodyPlaceholder')"
          />
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
          {{ saved ? t('pages.saved') : (saving ? t('admin.saving') : t('pages.saveChanges')) }}
        </Button>
        <Button
          variant="secondary"
          :disabled="publishing"
          @click="togglePublish"
        >
          {{ published ? t('pages.unpublish') : t('pages.publish') }}
        </Button>
      </div>
    </div>
  </div>
</template>
