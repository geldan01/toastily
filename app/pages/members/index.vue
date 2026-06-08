<script setup lang="ts">
import { Mail, Wrench } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

const { t, locale } = useI18n()

type Position = { nameEn: string, nameFr: string }
type Member = {
  id: string
  name: string
  email: string
  status: 'member' | 'officer' | 'admin'
  since: string
  positions: Position[]
}

const { data } = await useFetch<{ members: Member[] }>('/api/members/roster', {
  key: 'members-roster',
  default: () => ({ members: [] }),
})

const members = computed(() => data.value?.members ?? [])

const statusLabel = (s: Member['status']) => t(`account.status${s.charAt(0).toUpperCase()}${s.slice(1)}`)
const positionLabel = (p: Position) => (locale.value === 'fr' ? p.nameFr : p.nameEn)

function fmt(date: string) {
  return new Date(date).toLocaleDateString(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long',
  })
}

useHead(() => ({ title: t('members.title') }))
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12">
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('members.title') }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('members.subtitle') }}
      </p>
    </header>

    <!-- Tools + Messages placeholder hub (PRD §7.1) -->
    <div class="mb-10 grid gap-4 sm:grid-cols-2">
      <Card class="opacity-70">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <Mail class="size-4" /> {{ t('members.messages.title') }}
          </CardTitle>
          <CardDescription>{{ t('members.messages.soon') }}</CardDescription>
        </CardHeader>
      </Card>
      <Card class="opacity-70">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <Wrench class="size-4" /> {{ t('members.tools.title') }}
          </CardTitle>
          <CardDescription>{{ t('members.tools.soon') }}</CardDescription>
        </CardHeader>
      </Card>
    </div>

    <!-- Roster (PRD §7.1) -->
    <section>
      <h2 class="mb-4 text-xl font-semibold tracking-tight">
        {{ t('members.roster.title') }}
        <span class="text-base font-normal text-muted-foreground">({{ members.length }})</span>
      </h2>

      <ul class="space-y-3">
        <li
          v-for="m in members"
          :key="m.id"
        >
          <Card>
            <CardHeader class="flex-row items-start justify-between gap-4 space-y-0">
              <div class="min-w-0">
                <CardTitle class="text-base">
                  {{ m.name }}
                </CardTitle>
                <CardDescription class="truncate">
                  <a
                    :href="`mailto:${m.email}`"
                    class="hover:underline"
                  >{{ m.email }}</a>
                  · {{ t('members.roster.since', { date: fmt(m.since) }) }}
                </CardDescription>
                <div
                  v-if="m.positions.length"
                  class="mt-2 flex flex-wrap gap-1.5"
                >
                  <Badge
                    v-for="p in m.positions"
                    :key="p.nameEn"
                    variant="secondary"
                  >
                    {{ positionLabel(p) }}
                  </Badge>
                </div>
              </div>
              <Badge :variant="m.status === 'member' ? 'outline' : 'default'">
                {{ statusLabel(m.status) }}
              </Badge>
            </CardHeader>
          </Card>
        </li>
      </ul>
    </section>
  </div>
</template>
