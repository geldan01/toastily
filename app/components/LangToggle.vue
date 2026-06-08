<script setup lang="ts">
import { Languages } from '@lucide/vue'

const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const available = computed(() =>
  (locales.value as { code: string, name?: string }[]).map(l => ({
    code: l.code,
    name: l.name ?? l.code.toUpperCase(),
  })),
)
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="gap-1.5"
        :aria-label="$t('lang.switch')"
      >
        <Languages class="size-4" />
        <span class="uppercase">{{ locale }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        v-for="l in available"
        :key="l.code"
        as-child
      >
        <NuxtLink :to="switchLocalePath(l.code)">{{ l.name }}</NuxtLink>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
