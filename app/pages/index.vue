<script setup lang="ts">
import { ArrowRight, Quote } from '@lucide/vue'

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

// Featured member testimonials (issue #27), per-locale and pre-ordered server-side.
interface Testimonial { id: string, name: string, body: string, avatarUrl: string | null }
const { data: testimonials } = await useFetch<{ en: Testimonial[], fr: Testimonial[] }>(
  '/api/testimonials/featured',
  { key: 'testimonials-featured', default: () => ({ en: [], fr: [] }) },
)
const featured = computed(() => (locale.value === 'fr' ? testimonials.value.fr : testimonials.value.en))

const hero = computed(() => blocks.value.find(b => b.section === 'hero'))
const benefits = computed(() => blocks.value.filter(b => b.section === 'benefit'))
const whyJoin = computed(() => blocks.value.find(b => b.section === 'why_join'))
const latestNews = computed(() => allNews.value.slice(0, 3))

const clubName = computed(() => setting('club.name', 'Toastily'))

// Rotating hero backgrounds from the landing.hero_images setting (comma-
// separated URLs). Crossfades on a timer; static when the visitor prefers
// reduced motion or only one image is configured.
const heroImages = computed(() =>
  setting('landing.hero_images', '').split(',').map(s => s.trim()).filter(Boolean),
)
const heroIndex = ref(0)
let heroTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (heroImages.value.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    heroTimer = setInterval(() => {
      heroIndex.value = (heroIndex.value + 1) % heroImages.value.length
    }, 7000)
  }
})
onUnmounted(() => clearInterval(heroTimer))

useHead(() => ({ title: clubName.value }))
</script>

<template>
  <div>
    <!-- Hero (rotating background images behind a gradient for text contrast) -->
    <section class="relative overflow-hidden bg-primary text-primary-foreground">
      <img
        v-for="(src, i) in heroImages"
        :key="src"
        :src="src"
        alt=""
        aria-hidden="true"
        :loading="i === 0 ? 'eager' : 'lazy'"
        class="absolute inset-0 size-full object-cover transition-opacity duration-1000"
        :class="i === heroIndex ? 'opacity-100' : 'opacity-0'"
      >
      <div
        v-if="heroImages.length"
        class="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary/30"
      />
      <div class="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 md:py-28">
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

    <!-- Member testimonials -->
    <section
      v-if="featured.length"
      class="mx-auto max-w-6xl px-4 py-16"
    >
      <h2 class="mb-8 text-2xl font-bold md:text-3xl">
        {{ t('landing.testimonials') }}
      </h2>
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="quote in featured"
          :key="quote.id"
          class="h-full"
        >
          <CardContent class="flex h-full flex-col gap-4">
            <Quote class="size-6 text-primary/40" />
            <p class="flex-1 text-base italic text-foreground">
              {{ quote.body }}
            </p>
            <div class="flex items-center gap-3 border-t pt-4">
              <MemberAvatar
                :name="quote.name"
                :src="quote.avatarUrl"
                :size="40"
              />
              <p class="text-sm font-medium text-muted-foreground">
                {{ quote.name }}
              </p>
            </div>
          </CardContent>
        </Card>
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
