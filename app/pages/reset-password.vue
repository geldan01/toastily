<script setup lang="ts">
const route = useRoute()
const localePath = useLocalePath()
const { t } = useI18n()

const password = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)
const token = computed(() => String(route.query.token ?? ''))

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/reset', {
      method: 'POST',
      body: { token: token.value, password: password.value },
    })
    done.value = true
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.verifyFailed'))
  }
  finally {
    loading.value = false
  }
}

useHead(() => ({ title: t('auth.resetTitle') }))
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col px-4 py-16">
    <Card>
      <CardHeader>
        <CardTitle>{{ t('auth.resetTitle') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          v-if="done"
          class="space-y-4"
        >
          <p class="text-sm">
            {{ t('auth.resetDone') }}
          </p>
          <Button
            as-child
            class="w-full"
          >
            <NuxtLink :to="localePath('/login')">{{ t('auth.login') }}</NuxtLink>
          </Button>
        </div>
        <form
          v-else
          class="space-y-4"
          @submit.prevent="submit"
        >
          <div class="space-y-2">
            <Label for="password">{{ t('auth.password') }}</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
            />
            <p class="text-xs text-muted-foreground">
              {{ t('auth.passwordHint') }}
            </p>
          </div>
          <p
            v-if="error"
            class="text-sm text-destructive"
          >
            {{ error }}
          </p>
          <Button
            type="submit"
            class="w-full"
            :disabled="loading || !token"
          >
            {{ t('auth.resetCta') }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
