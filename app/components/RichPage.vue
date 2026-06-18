<script setup lang="ts">
/**
 * Public renderer for a standalone rich page (issue #16): About / FAQ.
 * Anyone can read; content lives as Editor.js block JSON and renders via the
 * shared NewsContent. Content managers see an Edit entry to the gated editor.
 * When a page isn't published yet, anonymous visitors get a friendly empty
 * state while editors still get the Edit button.
 */
import { Pencil } from '@lucide/vue'

interface PageData {
  slug: string
  titleEn: string | null
  titleFr: string | null
  contentEn: string | null
  contentFr: string | null
  updatedAt: string | null
}

const props = defineProps<{ slug: 'about' | 'faq' | 'privacy', titleKey: string }>()

const { locale, t } = useI18n()
const localePath = useLocalePath()
const { data: caps } = useCapabilities()
const canEdit = computed(() => caps.value?.canManageContent ?? false)

const { data } = await useFetch<{ page: PageData | null }>(
  () => `/api/pages/${props.slug}`,
  { key: () => `page-${props.slug}`, default: () => ({ page: null }) },
)

const page = computed(() => data.value?.page ?? null)
const title = computed(() => (page.value ? localized(page.value, 'title', locale.value) : '') || t(props.titleKey))
const body = computed(() => (page.value ? localized(page.value, 'content', locale.value) : ''))

useHead(() => ({ title: title.value }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <header class="mb-8 flex items-start justify-between gap-4">
      <h1 class="text-3xl font-bold tracking-tight md:text-4xl">
        {{ title }}
      </h1>
      <Button
        v-if="canEdit"
        as-child
        variant="outline"
        size="sm"
        class="shrink-0"
      >
        <NuxtLink :to="localePath(`/admin/pages/${slug}`)">
          <Pencil class="size-4" />
          {{ t('pages.edit') }}
        </NuxtLink>
      </Button>
    </header>

    <NewsContent
      v-if="body"
      :content="body"
    />
    <p
      v-else
      class="text-muted-foreground"
    >
      {{ t('pages.empty') }}
    </p>
  </div>
</template>
