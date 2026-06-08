<script setup lang="ts">
const { fetch: refreshSession, loggedIn } = useUserSession()
const localePath = useLocalePath()
const { t } = useI18n()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

if (loggedIn.value) await navigateTo(localePath('/account'))

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    await refreshSession()
    await navigateTo(localePath('/account'))
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.genericError'))
  }
  finally {
    loading.value = false
  }
}

useHead(() => ({ title: t('auth.login') }))
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col px-4 py-16">
    <Card>
      <CardHeader>
        <CardTitle>{{ t('auth.login') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          class="space-y-4"
          @submit.prevent="submit"
        >
          <div class="space-y-2">
            <Label for="email">{{ t('auth.email') }}</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
            />
          </div>
          <div class="space-y-2">
            <Label for="password">{{ t('auth.password') }}</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
            />
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
            :disabled="loading"
          >
            {{ t('auth.loginCta') }}
          </Button>
        </form>
      </CardContent>
      <CardFooter class="flex flex-col items-start gap-2 text-sm text-muted-foreground">
        <NuxtLink
          :to="localePath('/forgot-password')"
          class="hover:text-foreground"
        >{{ t('auth.forgot') }}</NuxtLink>
        <span>
          {{ t('auth.noAccount') }}
          <NuxtLink
            :to="localePath('/register')"
            class="font-medium text-primary hover:underline"
          >{{ t('auth.register') }}</NuxtLink>
        </span>
      </CardFooter>
    </Card>
  </div>
</template>
