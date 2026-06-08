<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'

const { locale, t } = useI18n()
const localePath = useLocalePath()
const { setting } = useSettings()

type Block = Record<string, unknown> & { section: string }

const { data: blocks } = await useFetch<Block[]>('/api/content/home', {
  key: 'content-home',
  default: () => [],
})
const { data: allNews } = await useFetch<Record<string, unknown>[]>('/api/news', {
  key: 'news-list',
  default: () => [],
})

const hero = computed(() => blocks.value.find(b => b.section === 'hero'))
const benefits = computed(() => blocks.value.filter(b => b.section === 'benefit'))
const whyJoin = computed(() => blocks.value.find(b => b.section === 'why_join'))
const latestNews = computed(() => allNews.value.slice(0, 3))

const clubName = computed(() => setting('club.name', 'Toastily'))

useHead(() => ({ title: clubName.value }))
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="bg-primary text-primary-foreground">
      <div class="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 md:py-28">
        <h1 class="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
          {{ hero ? localized(hero, 'title', locale) : clubName }}
        </h1>
        <p
          v-if="hero"
          class="max-w-2xl text-lg text-primary-foreground/85"
        >
          {{ localized(hero, 'body', locale) }}
        </p>
        <Button
          v-if="hero?.ctaHref"
          as-child
          size="lg"
          class="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <NuxtLink :to="localePath((hero.ctaHref as string))">
            {{ localized(hero, 'ctaLabel', locale) || t('landing.joinCta') }}
            <ArrowRight class="size-4" />
          </NuxtLink>
        </Button>
      </div>
    </section>

    <!-- Key benefits -->
    <section
      v-if="benefits.length"
      class="mx-auto max-w-6xl px-4 py-16"
    >
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="b in benefits"
          :key="(b.id as string)"
          class="h-full"
        >
          <CardHeader>
            <CardTitle class="text-primary">
              {{ localized(b, 'title', locale) }}
            </CardTitle>
            <CardDescription class="text-base">
              {{ localized(b, 'body', locale) }}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </section>

    <!-- Why join -->
    <section
      v-if="whyJoin"
      class="bg-muted/40"
    >
      <div class="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 class="text-2xl font-bold md:text-3xl">
          {{ localized(whyJoin, 'title', locale) }}
        </h2>
        <p class="mx-auto mt-4 max-w-2xl text-muted-foreground">
          {{ localized(whyJoin, 'body', locale) }}
        </p>
      </div>
    </section>

    <!-- Latest news -->
    <section class="mx-auto max-w-6xl px-4 py-16">
      <div class="mb-8 flex items-end justify-between gap-4">
        <h2 class="text-2xl font-bold md:text-3xl">
          {{ t('landing.latestNews') }}
        </h2>
        <Button
          as-child
          variant="link"
          class="text-primary"
        >
          <NuxtLink :to="localePath('/news')">
            {{ t('landing.viewAllNews') }}
            <ArrowRight class="size-4" />
          </NuxtLink>
        </Button>
      </div>

      <div
        v-if="latestNews.length"
        class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <NewsCard
          v-for="n in latestNews"
          :key="(n.id as string)"
          :item="n"
        />
      </div>
      <p
        v-else
        class="text-muted-foreground"
      >
        {{ t('landing.noContent') }}
      </p>
    </section>
  </div>
</template>
