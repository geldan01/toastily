<script setup lang="ts">
import { Check } from '@lucide/vue'

definePageMeta({ middleware: 'admin' })

const { t, te } = useI18n()

const identityFields = [
  'club.name',
  'club.tagline_en',
  'club.tagline_fr',
  'club.email',
  'club.phone',
  'club.number',
  'club.area',
  'club.division',
  'club.district',
  'landing.hero_images',
  'branding.logo_url',
] as const

const meetingFields = [
  'meeting.day_en',
  'meeting.day_fr',
  'meeting.time',
  'meeting.start_time',
  'meeting.address',
  'meeting.location_note_en',
  'meeting.location_note_fr',
  'meeting.frequency_weeks',
  'meeting.number_start',
] as const

// Speech timing window + agenda buffer (PRD §6.3).
const speechFields = [
  'speech.default_min_minutes',
  'speech.default_max_minutes',
  'speech.agenda_buffer_minutes',
] as const

// Guest self-check-in QR target (PRD §9).
const qrFields = [
  'qr.target_url',
] as const

// Admin-only email delivery credentials (PRD §2.2, §10). Used by Resend.
const emailFields = [
  'resend.api_key',
  'email.from_address',
] as const

const allFields = [...identityFields, ...meetingFields, ...speechFields, ...qrFields, ...emailFields]

// Whole-number settings — rendered as min-constrained number inputs and
// validated server-side (see server/api/admin/settings.patch.ts).
const integerFields: Record<string, number> = {
  'meeting.frequency_weeks': 1,
  'meeting.number_start': 1,
  'speech.default_min_minutes': 1,
  'speech.default_max_minutes': 1,
  'speech.agenda_buffer_minutes': 0,
}

// Map a setting key to its i18n label (e.g. club.tagline_en → admin.f.tagline_en).
function suffix(key: string) {
  return key.slice(key.indexOf('.') + 1)
}
function labelKey(key: string) {
  return `admin.f.${suffix(key)}`
}
// Optional per-field help text, rendered when admin.h.<suffix> exists.
function hintKey(key: string) {
  return `admin.h.${suffix(key)}`
}

function inputType(key: string) {
  if (key in integerFields) return 'number'
  if (key === 'club.email') return 'email'
  if (key === 'qr.target_url') return 'url'
  if (key === 'resend.api_key') return 'password'
  return 'text'
}

const { data } = await useFetch<{ settings: Record<string, string> }>('/api/admin/settings', {
  key: 'admin-settings',
})

const form = reactive<Record<string, string>>({})
watchEffect(() => {
  const s = data.value?.settings ?? {}
  allFields.forEach((k) => {
    if (!(k in form)) form[k] = s[k] ?? ''
  })
})

const saving = ref(false)
const saved = ref(false)
const error = ref('')

// Dismiss the feedback banner as soon as the admin starts editing again.
watch(form, () => {
  if (!saving.value) {
    saved.value = false
    error.value = ''
  }
})

async function save() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    await $fetch('/api/admin/settings', { method: 'PATCH', body: { settings: { ...form } } })
    await refreshNuxtData('public-settings')
    saved.value = true
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.genericError'))
  }
  finally {
    saving.value = false
  }
}

// Email delivery diagnostic: send a test message to the admin's own address and
// surface Resend's actual result (issue #28 — a misconfigured/unverified sender
// fails silently otherwise).
const testing = ref(false)
const testResult = ref<{ ok: boolean, mode: string, stubbed: boolean, sentTo: string, error: string | null } | null>(null)
const testError = ref('')

async function sendTest() {
  testing.value = true
  testResult.value = null
  testError.value = ''
  try {
    testResult.value = await $fetch('/api/admin/email-test', { method: 'POST' })
  }
  catch (e) {
    testError.value = errorMessage(e, t('auth.genericError'))
  }
  finally {
    testing.value = false
  }
}

useHead(() => ({ title: t('admin.settings') }))

const sections = [
  { titleKey: 'admin.sectionIdentity', fields: identityFields },
  { titleKey: 'admin.sectionMeeting', fields: meetingFields },
  { titleKey: 'admin.sectionSpeech', fields: speechFields },
  { titleKey: 'admin.sectionQr', fields: qrFields },
  { titleKey: 'admin.sectionEmail', fields: emailFields },
] as const
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight">
      {{ t('admin.settings') }}
    </h1>
    <p class="mt-2 text-sm text-muted-foreground">
      {{ t('admin.settingsIntro') }}
    </p>

    <!-- Feedback banner -->
    <div
      v-if="saved"
      class="mt-6 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
    >
      <Check class="size-4" />
      {{ t('admin.saved') }}
    </div>
    <div
      v-else-if="error"
      class="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {{ error }}
    </div>

    <form
      class="mt-8 space-y-8"
      @submit.prevent="save"
    >
      <Card
        v-for="section in sections"
        :key="section.titleKey"
      >
        <CardHeader>
          <CardTitle class="text-lg">
            {{ t(section.titleKey) }}
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            v-for="key in section.fields"
            :key="key"
            class="space-y-2"
          >
            <Label :for="key">{{ t(labelKey(key)) }}</Label>
            <Input
              :id="key"
              v-model="form[key]"
              :type="inputType(key)"
              :min="key in integerFields ? integerFields[key] : undefined"
              :step="key in integerFields ? 1 : undefined"
              :autocomplete="inputType(key) === 'password' ? 'off' : undefined"
            />
            <p
              v-if="te(hintKey(key))"
              class="text-xs text-muted-foreground"
            >
              {{ t(hintKey(key)) }}
            </p>
          </div>

          <!-- Delivery diagnostic for the email section (issue #28). Save first,
               then send a test to verify the saved key + sender actually work. -->
          <div
            v-if="section.titleKey === 'admin.sectionEmail'"
            class="border-t pt-4 space-y-3"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="testing"
              @click="sendTest"
            >
              {{ testing ? t('admin.emailTest.sending') : t('admin.emailTest.send') }}
            </Button>
            <p class="text-xs text-muted-foreground">
              {{ t('admin.emailTest.hint') }}
            </p>
            <p
              v-if="testError"
              class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {{ testError }}
            </p>
            <p
              v-else-if="testResult"
              class="rounded-md border px-3 py-2 text-sm"
              :class="testResult.ok && !testResult.stubbed
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-300 bg-amber-50 text-amber-900'"
            >
              <template v-if="testResult.ok && !testResult.stubbed">
                {{ t('admin.emailTest.ok', { email: testResult.sentTo }) }}
              </template>
              <template v-else-if="testResult.mode === 'misconfigured'">
                {{ t('admin.emailTest.misconfigured') }}
              </template>
              <template v-else-if="testResult.stubbed">
                {{ t('admin.emailTest.stub') }}
              </template>
              <template v-else>
                {{ t('admin.emailTest.failed', { error: testResult.error || 'unknown' }) }}
              </template>
            </p>
          </div>
        </CardContent>
      </Card>

      <div class="sticky bottom-4 flex items-center gap-3">
        <Button
          type="submit"
          size="lg"
          :disabled="saving"
        >
          {{ saving ? t('admin.saving') : t('admin.save') }}
        </Button>
        <span
          v-if="saved"
          class="flex items-center gap-1 text-sm font-medium text-emerald-700"
        >
          <Check class="size-4" /> {{ t('admin.saved') }}
        </span>
      </div>
    </form>
  </div>
</template>
