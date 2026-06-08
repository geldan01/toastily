<script setup lang="ts">
const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const localePath = useLocalePath()
const { t } = useI18n()

const state = ref<'verifying' | 'ok' | 'fail'>('verifying')

onMounted(async () => {
  const token = String(route.query.token ?? '')
  if (!token) {
    state.value = 'fail'
    return
  }
  try {
    await $fetch('/api/auth/verify', { method: 'POST', body: { token } })
    await refreshSession()
    state.value = 'ok'
  }
  catch {
    state.value = 'fail'
  }
})

useHead(() => ({ title: t('auth.verifying') }))
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col px-4 py-16">
    <Card>
      <CardHeader>
        <CardTitle>{{ t('auth.login') }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <p
          v-if="state === 'verifying'"
          class="text-sm text-muted-foreground"
        >
          {{ t('auth.verifying') }}
        </p>
        <template v-else-if="state === 'ok'">
          <p class="text-sm">
            {{ t('auth.verified') }}
          </p>
          <Button
            as-child
            class="w-full"
          >
            <NuxtLink :to="localePath('/account')">{{ t('account.title') }}</NuxtLink>
          </Button>
        </template>
        <template v-else>
          <p class="text-sm text-destructive">
            {{ t('auth.verifyFailed') }}
          </p>
          <Button
            as-child
            variant="outline"
            class="w-full"
          >
            <NuxtLink :to="localePath('/login')">{{ t('auth.login') }}</NuxtLink>
          </Button>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
