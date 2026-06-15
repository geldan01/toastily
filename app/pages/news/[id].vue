<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'

const route = useRoute()
const { locale, t } = useI18n()
const localePath = useLocalePath()

const { data: article, error } = await useFetch<Record<string, unknown>>(
  () => `/api/news/${route.params.id}`,
  { key: `news-${route.params.id}` },
)

// Surface a real 404 (status + error.vue) for a missing/unpublished article.
if (error.value || !article.value) {
  throw createError({ statusCode: 404, statusMessage: t('news.notFound'), fatal: true })
}

const title = computed(() => (article.value ? localized(article.value, 'title', locale.value) : ''))
const body = computed(() => (article.value ? localized(article.value, 'content', locale.value) : ''))
const image = computed(() => (article.value?.image as string) || '')
const date = computed(() => {
  const raw = article.value?.publishedAt as string | null
  if (!raw) return ''
  return new Date(raw).toLocaleDateString(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
})

useHead(() => ({ title: title.value || t('news.notFound') }))
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 py-12">
    <Button
      as-child
      variant="ghost"
      size="sm"
      class="mb-6 -ml-2"
    >
      <NuxtLink :to="localePath('/news')">
        <ArrowLeft class="size-4" />
        {{ t('common.backToNews') }}
      </NuxtLink>
    </Button>

    <p
      v-if="date"
      class="text-sm text-muted-foreground"
    >
      {{ date }}
    </p>
    <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
      {{ title }}
    </h1>

    <img
      v-if="image"
      :src="image"
      :alt="title"
      class="mt-8 aspect-video w-full rounded-lg object-cover"
    >

    <NewsContent
      class="mt-8"
      :content="body"
    />
  </article>
</template>
