<script setup lang="ts">
import { Eye, EyeOff, Newspaper, Pencil, Plus, Trash2 } from '@lucide/vue'

// News authoring list (issue #12). Gated by the content-edit capability — admin
// or a content-managing executive/grant — enforced by both this middleware and
// every /api/admin/news endpoint.
definePageMeta({ middleware: 'content' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

interface NewsRow {
  id: string
  titleEn: string
  titleFr: string
  publishedAt: string | null
  createdAt: string
}

const { data, refresh } = await useFetch<{ news: NewsRow[] }>('/api/admin/news', {
  key: 'admin-news-list',
})
const items = computed(() => data.value?.news ?? [])

const creating = ref(false)
const error = ref('')

function fmtDate(raw: string | null) {
  if (!raw) return ''
  return new Date(raw).toLocaleDateString(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

async function createDraft() {
  creating.value = true
  error.value = ''
  try {
    const { article } = await $fetch<{ article: { id: string } }>('/api/admin/news', { method: 'POST' })
    await navigateTo(localePath(`/admin/news/${article.id}`))
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.genericError'))
  }
  finally {
    creating.value = false
  }
}

async function togglePublish(row: NewsRow) {
  error.value = ''
  try {
    const action = row.publishedAt ? 'unpublish' : 'publish'
    await $fetch(`/api/admin/news/${row.id}/${action}`, { method: 'POST' })
    await refresh()
  }
  catch (e) {
    error.value = errorMessage(e, t('admin.news.publishBlocked'))
  }
}

async function remove(row: NewsRow) {
  if (!confirm(t('admin.news.confirmDelete'))) return
  error.value = ''
  try {
    await $fetch(`/api/admin/news/${row.id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.genericError'))
  }
}

useHead(() => ({ title: t('admin.news.title') }))
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12">
    <header class="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Newspaper class="size-7 text-primary" />
          {{ t('admin.news.title') }}
        </h1>
        <p class="mt-2 text-muted-foreground">
          {{ t('admin.news.intro') }}
        </p>
      </div>
      <Button
        :disabled="creating"
        @click="createDraft"
      >
        <Plus class="size-4" />
        {{ t('admin.news.new') }}
      </Button>
    </header>

    <p
      v-if="error"
      class="mb-4 text-sm text-destructive"
    >
      {{ error }}
    </p>

    <Card v-if="items.length">
      <CardContent class="divide-y p-0">
        <div
          v-for="row in items"
          :key="row.id"
          class="flex items-center justify-between gap-4 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="truncate font-medium">
              {{ row.titleEn || row.titleFr || t('admin.news.untitled') }}
            </p>
            <p class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge :variant="row.publishedAt ? 'default' : 'secondary'">
                {{ row.publishedAt ? t('admin.news.published') : t('admin.news.draft') }}
              </Badge>
              <span>{{ fmtDate(row.publishedAt ?? row.createdAt) }}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <Button
              as-child
              variant="ghost"
              size="sm"
            >
              <NuxtLink :to="localePath(`/admin/news/${row.id}`)">
                <Pencil class="size-4" />
                <span class="sr-only sm:not-sr-only">{{ t('admin.news.edit') }}</span>
              </NuxtLink>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              @click="togglePublish(row)"
            >
              <component
                :is="row.publishedAt ? EyeOff : Eye"
                class="size-4"
              />
              <span class="sr-only sm:not-sr-only">
                {{ row.publishedAt ? t('admin.news.unpublish') : t('admin.news.publish') }}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="text-destructive hover:text-destructive"
              @click="remove(row)"
            >
              <Trash2 class="size-4" />
              <span class="sr-only">{{ t('admin.news.delete') }}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    <p
      v-else
      class="text-muted-foreground"
    >
      {{ t('admin.news.none') }}
    </p>
  </div>
</template>
