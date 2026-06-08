<script setup lang="ts">
const { fetch: refreshSession, loggedIn } = useUserSession()
const localePath = useLocalePath()
const { t, locale } = useI18n()

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const done = ref<null | 'verified' | 'pending'>(null)

if (loggedIn.value) await navigateTo(localePath('/account'))

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{ verified: boolean }>('/api/auth/register', {
      method: 'POST',
      body: { name: name.value, email: email.value, password: password.value, locale: locale.value },
    })
    if (res.verified) {
      // First user (admin) is logged in immediately.
      await refreshSession()
      await navigateTo(localePath('/account'))
    }
    else {
      done.value = 'pending'
    }
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.genericError'))
  }
  finally {
    loading.value = false
  }
}

useHead(() => ({ title: t('auth.register') }))
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col px-4 py-16">
    <Card>
      <CardHeader>
        <CardTitle>{{ t('auth.register') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          v-if="done === 'pending'"
          class="space-y-2"
        >
          <p class="text-sm">
            {{ t('auth.checkEmail') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('auth.devEmailNote') }}
          </p>
        </div>
        <form
          v-else
          class="space-y-4"
          @submit.prevent="submit"
        >
          <div class="space-y-2">
            <Label for="name">{{ t('auth.name') }}</Label>
            <Input
              id="name"
              v-model="name"
              required
              autocomplete="name"
            />
          </div>
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
            :disabled="loading"
          >
            {{ t('auth.registerCta') }}
          </Button>
        </form>
      </CardContent>
      <CardFooter class="text-sm text-muted-foreground">
        <span>
          {{ t('auth.haveAccount') }}
          <NuxtLink
            :to="localePath('/login')"
            class="font-medium text-primary hover:underline"
          >{{ t('auth.login') }}</NuxtLink>
        </span>
      </CardFooter>
    </Card>
  </div>
</template>
