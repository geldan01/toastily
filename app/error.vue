<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const { t } = useI18n()
const localePath = useLocalePath()

const is404 = computed(() => props.error?.statusCode === 404)

function handleHome() {
  clearError({ redirect: localePath('/') })
}
</script>

<template>
  <div class="grid min-h-screen place-items-center bg-background px-4 text-center">
    <div>
      <p class="text-6xl font-bold text-primary">
        {{ error?.statusCode || 500 }}
      </p>
      <h1 class="mt-4 text-xl font-semibold">
        {{ is404 ? t('error.404') : t('error.title') }}
      </h1>
      <Button
        class="mt-8"
        @click="handleHome"
      >
        {{ t('error.home') }}
      </Button>
    </div>
  </div>
</template>
