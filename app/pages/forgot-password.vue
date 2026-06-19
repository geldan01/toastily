<script setup lang="ts">
const localePath = useLocalePath()
const { t } = useI18n()

const config = useRuntimeConfig()
const captchaRequired = Boolean(config.public.turnstileSiteKey)

const email = ref('')
const sent = ref(false)
const loading = ref(false)
const captchaToken = ref('')
const captcha = useTemplateRef('captcha')

const captchaReady = computed(() => !captchaRequired || Boolean(captchaToken.value))

async function submit() {
  loading.value = true
  try {
    await $fetch('/api/auth/request-reset', { method: 'POST', body: { email: email.value, turnstileToken: captchaToken.value } })
    sent.value = true
  }
  catch {
    // Turnstile tokens are single-use — reset so the user can retry.
    captcha.value?.reset()
  }
  finally {
    loading.value = false
  }
}

useHead(() => ({ title: t('auth.forgotTitle') }))
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col px-4 py-16">
    <Card>
      <CardHeader>
        <CardTitle>{{ t('auth.forgotTitle') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          v-if="sent"
          class="space-y-2"
        >
          <p class="text-sm">
            {{ t('auth.forgotSent') }}
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
            <Label for="email">{{ t('auth.email') }}</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
            />
          </div>
          <TurnstileWidget
            ref="captcha"
            v-model="captchaToken"
            action="password-reset"
          />
          <Button
            type="submit"
            class="w-full"
            :disabled="loading || !captchaReady"
          >
            {{ t('auth.forgotCta') }}
          </Button>
        </form>
      </CardContent>
      <CardFooter class="text-sm">
        <NuxtLink
          :to="localePath('/login')"
          class="text-primary hover:underline"
        >{{ t('auth.login') }}</NuxtLink>
      </CardFooter>
    </Card>
  </div>
</template>
