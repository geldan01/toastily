<script setup lang="ts">
import { MailCheck } from '@lucide/vue'

const { fetch: refreshSession, loggedIn } = useUserSession()
const localePath = useLocalePath()
const { t, locale } = useI18n()
const { setting } = useSettings()

const config = useRuntimeConfig()
const captchaRequired = Boolean(config.public.turnstileSiteKey)

const clubName = computed(() => setting('club.name', 'Toastily'))
// The club's configured logo (the official Toastmasters logo), with a graceful
// fallback to a club-initial monogram — mirrors AppHeader's branding.
const logoUrl = computed(() => setting('branding.logo_url', ''))
const logoFailed = ref(false)

const name = ref('')
const email = ref('')
const password = ref('')
const consent = ref(false)
const captchaToken = ref('')
const captcha = useTemplateRef('captcha')
const error = ref('')
const loading = ref(false)
const done = ref<null | 'verified' | 'pending'>(null)

// Submit is blocked until the CAPTCHA is solved (when one is configured).
const captchaReady = computed(() => !captchaRequired || Boolean(captchaToken.value))

if (loggedIn.value) await navigateTo(localePath('/account'))

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{ verified: boolean }>('/api/auth/register', {
      method: 'POST',
      body: { name: name.value, email: email.value, password: password.value, locale: locale.value, consent: consent.value, turnstileToken: captchaToken.value },
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
    // Turnstile tokens are single-use — reset so the user can retry.
    captcha.value?.reset()
  }
  finally {
    loading.value = false
  }
}

useHead(() => ({ title: t('auth.register') }))
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col px-4 py-16">
    <!-- Post-registration: a branded confirmation, not a bare message (issue #53) -->
    <Card
      v-if="done === 'pending'"
      class="overflow-hidden"
    >
      <div class="flex flex-col items-center gap-3 bg-primary px-6 py-8 text-center text-primary-foreground">
        <img
          v-if="logoUrl && !logoFailed"
          :src="logoUrl"
          :alt="clubName"
          class="h-14 w-auto"
          @error="logoFailed = true"
        >
        <span
          v-else
          class="grid size-14 place-items-center rounded-md bg-primary-foreground/15 text-xl font-bold"
        >
          {{ clubName.charAt(0) }}
        </span>
        <span class="text-lg font-semibold tracking-tight">{{ clubName }}</span>
      </div>
      <CardContent class="space-y-5 px-6 py-8 text-center">
        <div class="flex justify-center">
          <span class="grid size-12 place-items-center rounded-full bg-accent/15 text-accent">
            <MailCheck class="size-6" />
          </span>
        </div>
        <div class="space-y-2">
          <h2 class="text-xl font-bold tracking-tight text-foreground">
            {{ t('auth.checkEmailTitle') }}
          </h2>
          <p class="text-sm text-muted-foreground">
            {{ t('auth.checkEmailLead', { club: clubName }) }}
          </p>
          <p class="text-sm font-medium text-foreground">
            {{ t('auth.checkEmail') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('auth.devEmailNote') }}
          </p>
        </div>
        <div class="flex flex-col gap-2 pt-1 sm:flex-row">
          <Button
            as-child
            class="w-full"
          >
            <NuxtLink :to="localePath('/login')">{{ t('auth.backToLogin') }}</NuxtLink>
          </Button>
          <Button
            as-child
            variant="outline"
            class="w-full"
          >
            <NuxtLink :to="localePath('/')">{{ t('auth.backToHome') }}</NuxtLink>
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card v-else>
      <CardHeader>
        <CardTitle>{{ t('auth.register') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
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
          <div class="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
            <input
              id="consent"
              v-model="consent"
              type="checkbox"
              required
              class="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
            >
            <Label
              for="consent"
              class="text-xs font-normal leading-relaxed text-muted-foreground"
            >
              <i18n-t
                keypath="auth.consentLabel"
                tag="span"
              >
                <template #policy>
                  <NuxtLink
                    :to="localePath('/privacy')"
                    target="_blank"
                    class="font-medium text-primary hover:underline"
                  >{{ t('auth.consentPolicyLink') }}</NuxtLink>
                </template>
              </i18n-t>
            </Label>
          </div>
          <TurnstileWidget
            ref="captcha"
            v-model="captchaToken"
            action="register"
          />
          <p
            v-if="error"
            class="text-sm text-destructive"
          >
            {{ error }}
          </p>
          <Button
            type="submit"
            class="w-full"
            :disabled="loading || !consent || !captchaReady"
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
