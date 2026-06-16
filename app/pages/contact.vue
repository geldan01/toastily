<script setup lang="ts">
// Public contact page (issue #16, PRD §5.2). Submits to /api/contact, which
// emails the club contact address via the shared Resend service (dev-stubbed
// locally). A hidden honeypot field deters naive bots.
import { Check, Loader2 } from '@lucide/vue'

const { t } = useI18n()
const { setting } = useSettings()

const clubEmail = computed(() => setting('club.email', ''))
const clubPhone = computed(() => setting('club.phone', ''))

const form = reactive({ name: '', email: '', message: '', company: '' })
const sending = ref(false)
const sent = ref(false)
const error = ref('')

async function submit() {
  sending.value = true
  error.value = ''
  try {
    await $fetch('/api/contact', { method: 'POST', body: { ...form } })
    sent.value = true
  }
  catch (e) {
    error.value = errorMessage(e, t('contact.error'))
  }
  finally {
    sending.value = false
  }
}

useHead(() => ({ title: t('contact.title') }))
</script>

<template>
  <div class="mx-auto max-w-xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight md:text-4xl">
      {{ t('contact.title') }}
    </h1>
    <p class="mt-3 text-muted-foreground">
      {{ t('contact.intro') }}
    </p>

    <ul
      v-if="clubEmail || clubPhone"
      class="mt-4 space-y-1 text-sm"
    >
      <li v-if="clubEmail">
        <span class="font-medium">{{ t('contact.emailLabel') }}:</span>
        <a
          :href="`mailto:${clubEmail}`"
          class="text-primary underline"
        >{{ clubEmail }}</a>
      </li>
      <li v-if="clubPhone">
        <span class="font-medium">{{ t('contact.phoneLabel') }}:</span> {{ clubPhone }}
      </li>
    </ul>

    <div
      v-if="sent"
      class="mt-8 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4"
    >
      <Check class="mt-0.5 size-5 shrink-0 text-primary" />
      <p class="text-sm">
        {{ t('contact.success') }}
      </p>
    </div>

    <form
      v-else
      class="mt-8 space-y-4"
      @submit.prevent="submit"
    >
      <div class="space-y-2">
        <Label for="name">{{ t('contact.name') }}</Label>
        <Input
          id="name"
          v-model="form.name"
          required
          autocomplete="name"
        />
      </div>
      <div class="space-y-2">
        <Label for="email">{{ t('contact.email') }}</Label>
        <Input
          id="email"
          v-model="form.email"
          type="email"
          required
          autocomplete="email"
        />
      </div>
      <div class="space-y-2">
        <Label for="message">{{ t('contact.message') }}</Label>
        <textarea
          id="message"
          v-model="form.message"
          required
          rows="6"
          class="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <!-- Honeypot: hidden from users, attractive to bots. -->
      <div
        aria-hidden="true"
        class="hidden"
      >
        <label>Company<input
          v-model="form.company"
          type="text"
          tabindex="-1"
          autocomplete="off"
        ></label>
      </div>

      <p
        v-if="error"
        class="text-sm text-destructive"
      >
        {{ error }}
      </p>

      <Button
        type="submit"
        :disabled="sending"
      >
        <Loader2
          v-if="sending"
          class="size-4 animate-spin"
        />
        {{ sending ? t('contact.sending') : t('contact.send') }}
      </Button>
    </form>
  </div>
</template>
