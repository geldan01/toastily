<script setup lang="ts">
import { Newspaper } from '@lucide/vue'

const props = defineProps<{
  item: Record<string, unknown>
}>()

const { locale } = useI18n()
const localePath = useLocalePath()

const title = computed(() => localized(props.item, 'title', locale.value))
const excerpt = computed(() => localized(props.item, 'excerpt', locale.value))
const image = computed(() => (props.item.image as string) || '')
const to = computed(() => localePath(`/news/${props.item.id as string}`))
const date = computed(() => {
  const raw = props.item.publishedAt as string | null
  if (!raw) return ''
  return new Date(raw).toLocaleDateString(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
})
</script>

<template>
  <NuxtLink
    :to="to"
    class="group block h-full"
  >
    <Card class="h-full overflow-hidden pt-0 transition-shadow hover:shadow-md">
      <div class="aspect-video w-full overflow-hidden bg-muted">
        <img
          v-if="image"
          :src="image"
          :alt="title"
          class="size-full object-cover transition-transform group-hover:scale-105"
        >
        <div
          v-else
          class="grid size-full place-items-center bg-gradient-to-br from-primary/10 to-secondary/10"
        >
          <Newspaper class="size-10 text-muted-foreground/40" />
        </div>
      </div>
      <CardHeader>
        <p
          v-if="date"
          class="text-xs text-muted-foreground"
        >{{ date }}</p>
        <CardTitle class="line-clamp-2 text-base group-hover:text-primary">{{ title }}</CardTitle>
        <CardDescription
          v-if="excerpt"
          class="line-clamp-3"
        >{{ excerpt }}</CardDescription>
      </CardHeader>
    </Card>
  </NuxtLink>
</template>
