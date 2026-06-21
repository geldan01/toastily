<script setup lang="ts">
import type { Component } from 'vue'
import { Award, ChevronDown, MessageSquare, Mic, Star, Trophy, UserCheck, Users } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

const { t } = useI18n()
const localePath = useLocalePath()

type MilestoneCategory = 'attendance' | 'speaking' | 'evaluation' | 'roles' | 'leadership' | 'awards'
type Holder = { id: string, name: string }
type BadgeRow = { key: string, category: MilestoneCategory, threshold: number, holders: Holder[] }

const { data } = await useFetch<{ badges: BadgeRow[] }>('/api/participation/badges', {
  key: 'achievement-badges',
  default: () => ({ badges: [] }),
})

const categoryIcon: Record<MilestoneCategory, Component> = {
  attendance: UserCheck,
  speaking: Mic,
  evaluation: MessageSquare,
  roles: Users,
  leadership: Star,
  awards: Award,
}
const CATEGORY_ORDER: MilestoneCategory[] = ['attendance', 'speaking', 'evaluation', 'roles', 'leadership', 'awards']

// Group the catalog by category, preserving the server's order within each.
const grouped = computed(() => {
  const byCat = new Map<MilestoneCategory, BadgeRow[]>()
  for (const b of data.value?.badges ?? []) {
    const list = byCat.get(b.category) ?? []
    list.push(b)
    byCat.set(b.category, list)
  }
  return CATEGORY_ORDER.filter(c => byCat.has(c)).map(c => ({ category: c, badges: byCat.get(c)! }))
})

const expanded = ref<string | null>(null)
function toggle(key: string) {
  expanded.value = expanded.value === key ? null : key
}

useHead(() => ({ title: t('achievements.title') }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <NuxtLink
      :to="localePath('/participation')"
      class="text-sm text-muted-foreground hover:text-foreground"
    >
      ← {{ t('participation.title') }}
    </NuxtLink>

    <header class="mt-3 mb-8">
      <h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight">
        <Trophy class="size-7" /> {{ t('achievements.title') }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('achievements.subtitle') }}
      </p>
    </header>

    <div class="space-y-8">
      <section
        v-for="group in grouped"
        :key="group.category"
      >
        <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-secondary uppercase">
          <component
            :is="categoryIcon[group.category]"
            class="size-4"
          />
          {{ t(`milestones.categories.${group.category}`) }}
        </h2>

        <ul class="space-y-2">
          <li
            v-for="b in group.badges"
            :key="b.key"
            class="overflow-hidden rounded-lg border"
          >
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
              :aria-expanded="expanded === b.key"
              @click="toggle(b.key)"
            >
              <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <component
                  :is="categoryIcon[b.category]"
                  class="size-4.5"
                />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block font-medium">{{ t(`milestones.${b.key}.name`) }}</span>
                <span class="block text-sm text-muted-foreground">{{ t(`milestones.${b.key}.desc`) }}</span>
              </span>
              <Badge
                variant="secondary"
                class="shrink-0 tabular-nums"
              >
                {{ b.holders.length }}
              </Badge>
              <ChevronDown
                class="size-4 shrink-0 text-muted-foreground transition-transform"
                :class="expanded === b.key ? 'rotate-180' : ''"
              />
            </button>

            <div
              v-if="expanded === b.key"
              class="border-t bg-muted/20 px-4 py-3"
            >
              <ul
                v-if="b.holders.length"
                class="flex flex-wrap gap-2"
              >
                <li
                  v-for="h in b.holders"
                  :key="h.id"
                >
                  <NuxtLink
                    :to="localePath(`/participation/${h.id}`)"
                    class="inline-block rounded-full border bg-background px-3 py-1 text-sm font-medium hover:bg-muted"
                  >
                    {{ h.name }}
                  </NuxtLink>
                </li>
              </ul>
              <p
                v-else
                class="text-sm text-muted-foreground"
              >
                {{ t('achievements.noOne') }}
              </p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
