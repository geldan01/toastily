<script setup lang="ts">
// Guest check-in form (PRD §9). Posts a name (+ optional email) to the public
// check-in endpoint — works logged-out (a guest self-checks-in via the QR) or
// logged-in (a member checks a guest in on the spot). Emits `checked-in` so a
// host page can refresh its guest list. Reused on /checkin and the meeting page.
const props = defineProps<{ meetingId: string }>()
const emit = defineEmits<{ 'checked-in': [name: string] }>()

const { t } = useI18n()

const name = ref('')
const email = ref('')
const busy = ref(false)
const error = ref('')
const done = ref('')

async function submit() {
  const trimmed = name.value.trim()
  if (!trimmed || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/meetings/checkin', {
      method: 'POST',
      body: { meetingId: props.meetingId, name: trimmed, email: email.value.trim() || undefined },
    })
    done.value = trimmed
    name.value = ''
    email.value = ''
    emit('checked-in', trimmed)
  }
  catch (e) { error.value = errorMessage(e, t('auth.genericError')) }
  finally { busy.value = false }
}
</script>

<template>
  <div>
    <div
      v-if="done"
      class="rounded-md border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm"
    >
      <p class="font-medium text-secondary">
        {{ t('meetings.checkedInThanks', { name: done }) }}
      </p>
      <Button
        size="sm"
        variant="ghost"
        class="mt-1"
        @click="done = ''"
      >
        {{ t('meetings.checkInAnother') }}
      </Button>
    </div>

    <form
      v-else
      class="flex w-full flex-wrap items-end gap-2"
      @submit.prevent="submit"
    >
      <div class="min-w-44 flex-1 space-y-1.5">
        <Label :for="`checkin-name-${meetingId}`">{{ t('meetings.yourName') }}</Label>
        <Input
          :id="`checkin-name-${meetingId}`"
          v-model="name"
          autocomplete="name"
        />
      </div>
      <div class="min-w-44 flex-1 space-y-1.5">
        <Label :for="`checkin-email-${meetingId}`">{{ t('meetings.optionalEmail') }}</Label>
        <Input
          :id="`checkin-email-${meetingId}`"
          v-model="email"
          type="email"
          autocomplete="email"
        />
      </div>
      <Button
        type="submit"
        size="sm"
        :disabled="!name.trim() || busy"
      >
        {{ t('meetings.checkInCta') }}
      </Button>
    </form>

    <p
      v-if="error"
      class="mt-2 text-sm font-medium text-destructive"
    >
      {{ error }}
    </p>
  </div>
</template>
