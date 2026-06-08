<script setup lang="ts">
const { t } = useI18n()

const { data: news } = await useFetch<Record<string, unknown>[]>('/api/news', {
  key: 'news-list',
  default: () => [],
})

useHead(() => ({ title: t('news.title') }))
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-12">
    <header class="mb-10">
      <h1 class="text-3xl font-bold tracking-tight md:text-4xl">
        {{ t('news.title') }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('news.subtitle') }}
      </p>
    </header>

    <div
      v-if="news.length"
      class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      <NewsCard
        v-for="n in news"
        :key="(n.id as string)"
        :item="n"
      />
    </div>
    <p
      v-else
      class="text-muted-foreground"
    >
      {{ t('news.empty') }}
    </p>
  </div>
</template>
