<script setup lang="ts">
import { Award, MessageSquare, Mic, Trophy, UserCheck, Users } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

type Position = { nameEn: string, nameFr: string }
type Row = {
  id: string
  name: string
  status: 'member' | 'officer' | 'admin'
  positions: Position[]
  attended: number
  roles: number
  speeches: number
  evaluations: number
  awards: number
}

const { data } = await useFetch<{ members: Row[] }>('/api/participation', {
  key: 'participation-summary',
  default: () => ({ members: [] }),
})

const query = ref('')
const rows = computed(() => {
  const list = data.value?.members ?? []
  const q = query.value.trim().toLowerCase()
  return q ? list.filter(r => r.name.toLowerCase().includes(q)) : list
})

const positionLabel = (p: Position) => (locale.value === 'fr' ? p.nameFr : p.nameEn)

useHead(() => ({ title: t('participation.title') }))
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-12">
    <header class="mb-8 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ t('participation.title') }}
        </h1>
        <p class="mt-2 text-muted-foreground">
          {{ t('participation.subtitle') }}
        </p>
      </div>
      <NuxtLink
        :to="localePath('/achievements')"
        class="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        <Trophy class="size-4" /> {{ t('achievements.title') }}
      </NuxtLink>
    </header>

    <div class="mb-4 max-w-xs">
      <Input
        v-model="query"
        type="search"
        :placeholder="t('participation.searchPlaceholder')"
      />
    </div>

    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b bg-muted/50 text-left">
            <th class="px-4 py-3 font-medium">
              {{ t('participation.member') }}
            </th>
            <th class="px-3 py-3 text-center font-medium">
              <span class="inline-flex items-center gap-1"><UserCheck class="size-4" /> <span class="hidden sm:inline">{{ t('participation.attended') }}</span></span>
            </th>
            <th class="px-3 py-3 text-center font-medium">
              <span class="inline-flex items-center gap-1"><Users class="size-4" /> <span class="hidden sm:inline">{{ t('participation.roles') }}</span></span>
            </th>
            <th class="px-3 py-3 text-center font-medium">
              <span class="inline-flex items-center gap-1"><Mic class="size-4" /> <span class="hidden sm:inline">{{ t('participation.speeches') }}</span></span>
            </th>
            <th class="px-3 py-3 text-center font-medium">
              <span class="inline-flex items-center gap-1"><MessageSquare class="size-4" /> <span class="hidden sm:inline">{{ t('participation.evaluations') }}</span></span>
            </th>
            <th class="px-3 py-3 text-center font-medium">
              <span class="inline-flex items-center gap-1"><Award class="size-4" /> <span class="hidden sm:inline">{{ t('participation.awards') }}</span></span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.id"
            class="cursor-pointer border-b last:border-0 hover:bg-muted/40"
            @click="navigateTo(localePath(`/participation/${r.id}`))"
          >
            <td class="px-4 py-3">
              <NuxtLink
                :to="localePath(`/participation/${r.id}`)"
                class="font-medium hover:underline"
                @click.stop
              >
                {{ r.name }}
              </NuxtLink>
              <div
                v-if="r.positions.length"
                class="mt-1 flex flex-wrap gap-1"
              >
                <Badge
                  v-for="p in r.positions"
                  :key="p.nameEn"
                  variant="secondary"
                  class="text-xs"
                >
                  {{ positionLabel(p) }}
                </Badge>
              </div>
            </td>
            <td class="px-3 py-3 text-center tabular-nums">
              {{ r.attended }}
            </td>
            <td class="px-3 py-3 text-center tabular-nums">
              {{ r.roles }}
            </td>
            <td class="px-3 py-3 text-center tabular-nums">
              {{ r.speeches }}
            </td>
            <td class="px-3 py-3 text-center tabular-nums">
              {{ r.evaluations }}
            </td>
            <td class="px-3 py-3 text-center tabular-nums">
              {{ r.awards }}
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td
              colspan="6"
              class="px-4 py-10 text-center text-muted-foreground"
            >
              {{ t('participation.empty') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
