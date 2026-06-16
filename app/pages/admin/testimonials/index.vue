<script setup lang="ts">
import { ChevronDown, ChevronUp, Quote } from '@lucide/vue'

// Testimonial curation (issue #27). Gated by the content-edit capability — admin
// or a content-managing executive/grant — enforced by both this middleware and
// every /api/admin/testimonials endpoint.
definePageMeta({ middleware: 'content' })

const { t } = useI18n()

interface Row {
  id: string
  userId: string
  name: string
  email: string
  bodyEn: string | null
  bodyFr: string | null
  featuredEn: boolean
  featuredFr: boolean
  featuredOrderEn: number | null
  featuredOrderFr: number | null
  updatedAt: string
}

const { data, refresh } = await useFetch<{ testimonials: Row[] }>('/api/admin/testimonials', {
  key: 'admin-testimonials',
})
const rows = computed(() => data.value?.testimonials ?? [])

const error = ref('')

// The featured ids of a language, ordered by that language's featuredOrder — the
// list reorder controls splice within this ordered set.
function featuredIds(locale: 'en' | 'fr') {
  const orderKey = locale === 'en' ? 'featuredOrderEn' : 'featuredOrderFr'
  const featuredKey = locale === 'en' ? 'featuredEn' : 'featuredFr'
  return rows.value
    .filter(r => r[featuredKey])
    .slice()
    .sort((a, b) => (a[orderKey] ?? 0) - (b[orderKey] ?? 0))
    .map(r => r.id)
}

async function toggleFeature(row: Row, locale: 'en' | 'fr') {
  error.value = ''
  try {
    const body = locale === 'en'
      ? { featuredEn: !row.featuredEn }
      : { featuredFr: !row.featuredFr }
    await $fetch(`/api/admin/testimonials/${row.id}`, { method: 'PATCH', body })
    await refresh()
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.genericError'))
  }
}

async function move(row: Row, locale: 'en' | 'fr', delta: number) {
  const ids = featuredIds(locale)
  const idx = ids.indexOf(row.id)
  const next = idx + delta
  if (idx === -1 || next < 0 || next >= ids.length) return
  ;[ids[idx], ids[next]] = [ids[next]!, ids[idx]!]
  error.value = ''
  try {
    await $fetch('/api/admin/testimonials/reorder', { method: 'POST', body: { locale, ids } })
    await refresh()
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.genericError'))
  }
}

useHead(() => ({ title: t('admin.testimonials.title') }))
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12">
    <header class="mb-8">
      <h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight">
        <Quote class="size-7 text-primary" />
        {{ t('admin.testimonials.title') }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('admin.testimonials.description') }}
      </p>
    </header>

    <p
      v-if="error"
      class="mb-4 text-sm text-destructive"
    >
      {{ error }}
    </p>

    <div
      v-if="rows.length"
      class="space-y-4"
    >
      <Card
        v-for="row in rows"
        :key="row.id"
      >
        <CardHeader>
          <CardTitle class="text-base">
            {{ row.name }}
          </CardTitle>
          <CardDescription>{{ row.email }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- English -->
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <Label>{{ t('admin.news.english') }}</Label>
              <Badge
                v-if="row.featuredEn"
                variant="secondary"
              >
                {{ t('admin.testimonials.featured') }}
              </Badge>
            </div>
            <p
              v-if="row.bodyEn"
              class="text-sm italic text-foreground"
            >
              {{ row.bodyEn }}
            </p>
            <p
              v-else
              class="text-sm text-muted-foreground"
            >
              {{ t('admin.testimonials.noEnglish') }}
            </p>
            <div class="flex items-center gap-1">
              <Button
                v-if="row.bodyEn"
                :variant="row.featuredEn ? 'secondary' : 'outline'"
                size="sm"
                @click="toggleFeature(row, 'en')"
              >
                {{ row.featuredEn ? t('admin.testimonials.unfeature') : t('admin.testimonials.feature') }}
              </Button>
              <template v-if="row.featuredEn">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  @click="move(row, 'en', -1)"
                >
                  <ChevronUp class="size-4" />
                  <span class="sr-only">{{ t('admin.testimonials.moveUp') }}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  @click="move(row, 'en', 1)"
                >
                  <ChevronDown class="size-4" />
                  <span class="sr-only">{{ t('admin.testimonials.moveDown') }}</span>
                </Button>
              </template>
            </div>
          </div>

          <!-- French -->
          <div class="space-y-2 border-t pt-4">
            <div class="flex flex-wrap items-center gap-2">
              <Label>{{ t('admin.news.french') }}</Label>
              <Badge
                v-if="row.featuredFr"
                variant="secondary"
              >
                {{ t('admin.testimonials.featured') }}
              </Badge>
            </div>
            <p
              v-if="row.bodyFr"
              class="text-sm italic text-foreground"
            >
              {{ row.bodyFr }}
            </p>
            <p
              v-else
              class="text-sm text-muted-foreground"
            >
              {{ t('admin.testimonials.noFrench') }}
            </p>
            <div class="flex items-center gap-1">
              <Button
                v-if="row.bodyFr"
                :variant="row.featuredFr ? 'secondary' : 'outline'"
                size="sm"
                @click="toggleFeature(row, 'fr')"
              >
                {{ row.featuredFr ? t('admin.testimonials.unfeature') : t('admin.testimonials.feature') }}
              </Button>
              <template v-if="row.featuredFr">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  @click="move(row, 'fr', -1)"
                >
                  <ChevronUp class="size-4" />
                  <span class="sr-only">{{ t('admin.testimonials.moveUp') }}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  @click="move(row, 'fr', 1)"
                >
                  <ChevronDown class="size-4" />
                  <span class="sr-only">{{ t('admin.testimonials.moveDown') }}</span>
                </Button>
              </template>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    <p
      v-else
      class="text-muted-foreground"
    >
      {{ t('admin.testimonials.empty') }}
    </p>
  </div>
</template>
