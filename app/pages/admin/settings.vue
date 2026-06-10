<script setup lang="ts">
import { Check } from '@lucide/vue'

definePageMeta({ middleware: 'admin' })

const { t } = useI18n()

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
] as const

// Admin-only email delivery credentials (PRD §2.2, §10). Used by Resend.
const emailFields = [
  'resend.api_key',
  'email.from_address',
] as const

// Map a setting key to its i18n label (e.g. club.tagline_en → admin.f.tagline_en).
function labelKey(key: string) {
  return `admin.f.${key.slice(key.indexOf('.') + 1)}`
}

const { data } = await useFetch<{ settings: Record<string, string> }>('/api/admin/settings', {
  key: 'admin-settings',
})

const form = reactive<Record<string, string>>({})
watchEffect(() => {
  const s = data.value?.settings ?? {};
  [...identityFields, ...meetingFields, ...emailFields].forEach((k) => {
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

useHead(() => ({ title: t('admin.settings') }))
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
      <Card>
        <CardHeader>
          <CardTitle class="text-lg">
            {{ t('admin.sectionIdentity') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            v-for="key in identityFields"
            :key="key"
            class="space-y-2"
          >
            <Label :for="key">{{ t(labelKey(key)) }}</Label>
            <Input
              :id="key"
              v-model="form[key]"
              :type="key === 'club.email' ? 'email' : 'text'"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-lg">
            {{ t('admin.sectionMeeting') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            v-for="key in meetingFields"
            :key="key"
            class="space-y-2"
          >
            <Label :for="key">{{ t(labelKey(key)) }}</Label>
            <Input
              :id="key"
              v-model="form[key]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-lg">
            {{ t('admin.sectionEmail') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            v-for="key in emailFields"
            :key="key"
            class="space-y-2"
          >
            <Label :for="key">{{ t(labelKey(key)) }}</Label>
            <Input
              :id="key"
              v-model="form[key]"
              :type="key === 'resend.api_key' ? 'password' : 'text'"
              autocomplete="off"
            />
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
