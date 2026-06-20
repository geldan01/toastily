<script setup lang="ts">
// Written peer evaluations (issue #60). PUBLIC — anyone checked in to the meeting
// may leave feedback on a speech: a logged-in member as themselves, or a guest via
// the name they checked in with. Not member-gated (no middleware).
import { CalendarDays, Check, MessageSquarePlus } from '@lucide/vue'

interface SpeechItem {
  id: string
  slot: number
  title: string | null
  speakerName: string | null
  speakerUserId: string | null
  speakerIsGuest: boolean
}
interface MyEval {
  id: string
  liked: string | null
  recommend: string | null
  structureRating: number
  vocalVarietyRating: number
  gesturesRating: number
}
interface EvalData {
  meetingId: string | null
  speeches: SpeechItem[]
  selfEligible: boolean
  mine: Record<string, MyEval>
}

const route = useRoute()
const date = computed(() => String(route.params.date))
const { locale, t } = useI18n()
const localePath = useLocalePath()
const { user } = useUserSession()
const isMember = computed(() => hasMinRole(user.value?.status, 'member'))

// Meeting header (theme/date). Reuse the public meeting detail endpoint.
interface MeetingDetail {
  meeting: { id: string, date: string, themeEn: string | null, themeFr: string | null } | null
}
const { data: meetingData } = await useFetch<MeetingDetail>(() => `/api/meetings/${date.value}`, {
  key: () => `meeting-${date.value}`,
})
const meeting = computed(() => meetingData.value?.meeting ?? null)
const theme = computed(() => meeting.value ? localized(meeting.value, 'theme', locale.value) : '')

const { data, refresh } = await useFetch<EvalData>(() => `/api/meetings/${date.value}/evaluations`, {
  key: () => `evaluations-${date.value}`,
})
const speeches = computed(() => data.value?.speeches ?? [])
const selfEligible = computed(() => data.value?.selfEligible ?? false)

// Guests identify by the name they checked in with.
const guestName = ref('')

interface FormState {
  liked: string
  recommend: string
  structure: number
  vocal: number
  gestures: number
  busy: boolean
  error: string
  done: boolean
}
const forms = ref<Record<string, FormState>>({})
watchEffect(() => {
  for (const s of speeches.value) {
    if (!forms.value[s.id]) {
      const mine = data.value?.mine?.[s.id]
      forms.value[s.id] = {
        liked: mine?.liked ?? '',
        recommend: mine?.recommend ?? '',
        structure: mine?.structureRating ?? 0,
        vocal: mine?.vocalVarietyRating ?? 0,
        gestures: mine?.gesturesRating ?? 0,
        busy: false,
        error: '',
        done: false,
      }
    }
  }
})

const isOwnSpeech = (s: SpeechItem) => isMember.value && !!user.value && s.speakerUserId === user.value.id
const hasMine = (s: SpeechItem) => !!data.value?.mine?.[s.id]

function canSubmit(s: SpeechItem) {
  const f = forms.value[s.id]
  if (!f || f.busy) return false
  if (isMember.value && !selfEligible.value) return false
  if (!isMember.value && !guestName.value.trim()) return false
  return f.structure >= 1 && f.vocal >= 1 && f.gestures >= 1
}

async function submit(s: SpeechItem) {
  const f = forms.value[s.id]
  if (!f) return
  if (f.structure < 1 || f.vocal < 1 || f.gestures < 1) {
    f.error = t('meetings.evalRatingsRequired')
    return
  }
  f.busy = true
  f.error = ''
  try {
    await $fetch('/api/meetings/evaluation', {
      method: 'POST',
      body: {
        speechId: s.id,
        liked: f.liked,
        recommend: f.recommend,
        structureRating: f.structure,
        vocalVarietyRating: f.vocal,
        gesturesRating: f.gestures,
        guestName: isMember.value ? undefined : guestName.value.trim(),
      },
    })
    f.done = true
    await refresh()
  }
  catch (e) { f.error = errorMessage(e, t('auth.genericError')) }
  finally { f.busy = false }
}

const prettyDate = computed(() => new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
}).format(new Date(`${date.value}T00:00:00`)))

useHead(() => ({ title: `${t('meetings.evalTitle')}${theme.value ? ` — ${theme.value}` : ''}` }))
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12">
    <NuxtLink
      :to="localePath(`/meeting/${date}`)"
      class="text-sm text-muted-foreground hover:text-foreground"
    >
      ← {{ t('meetings.backToMeeting') }}
    </NuxtLink>

    <div class="mt-3 flex items-center gap-2 text-sm font-medium text-secondary">
      <CalendarDays class="size-4" />
      {{ prettyDate }}
    </div>

    <template v-if="!meeting">
      <h1 class="mt-2 text-3xl font-bold tracking-tight">
        {{ t('meetings.noMeeting') }}
      </h1>
      <p class="mt-3 text-muted-foreground">
        {{ t('meetings.noMeetingBody') }}
      </p>
    </template>

    <template v-else>
      <h1 class="mt-2 flex items-center gap-2 text-3xl font-bold tracking-tight">
        <MessageSquarePlus class="size-7" />
        {{ t('meetings.evalTitle') }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('meetings.evalIntro') }}
      </p>

      <!-- Member not checked in: prompt to check in first -->
      <div
        v-if="isMember && !selfEligible"
        class="mt-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
      >
        {{ t('meetings.evalCheckInFirst') }}
        <NuxtLink
          :to="localePath(`/meeting/${date}/attendance`)"
          class="font-semibold underline"
        >
          {{ t('meetings.evalCheckInLink') }}
        </NuxtLink>
      </div>

      <!-- Guest name (logged-out / non-member visitors) -->
      <div
        v-if="!isMember"
        class="mt-6 rounded-lg border border-border p-4"
      >
        <label
          for="evalGuestName"
          class="text-sm font-medium"
        >{{ t('meetings.evalYourName') }}</label>
        <Input
          id="evalGuestName"
          v-model="guestName"
          class="mt-1.5"
          :placeholder="t('meetings.yourName')"
        />
        <p class="mt-1.5 text-xs text-muted-foreground">
          {{ t('meetings.evalYourNameHint') }}
        </p>
      </div>

      <p
        v-if="!speeches.length"
        class="mt-8 rounded-lg border border-border px-4 py-10 text-center text-muted-foreground"
      >
        {{ t('meetings.evalNoSpeeches') }}
      </p>

      <div
        v-else
        class="mt-8 space-y-6"
      >
        <section
          v-for="s in speeches"
          :key="s.id"
          class="rounded-lg border border-border p-5"
        >
          <header class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="text-lg font-semibold">
              {{ t('meetings.speechNum', { n: s.slot }) }}<template v-if="s.title">
                — {{ s.title }}
              </template>
            </h2>
            <span
              v-if="s.speakerName"
              class="text-sm text-muted-foreground"
            >
              {{ t('meetings.speaker') }}: {{ s.speakerName }}
            </span>
          </header>

          <!-- Can't evaluate your own speech -->
          <p
            v-if="isOwnSpeech(s)"
            class="mt-3 text-sm text-muted-foreground"
          >
            {{ t('meetings.evalYourSpeech') }}
          </p>

          <template v-else>
            <div class="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p class="mb-1 text-sm font-medium">
                  {{ t('meetings.evalStructure') }}
                </p>
                <StarRating
                  v-model="forms[s.id]!.structure"
                  :aria-label="t('meetings.evalStructure')"
                />
              </div>
              <div>
                <p class="mb-1 text-sm font-medium">
                  {{ t('meetings.evalVocalVariety') }}
                </p>
                <StarRating
                  v-model="forms[s.id]!.vocal"
                  :aria-label="t('meetings.evalVocalVariety')"
                />
              </div>
              <div>
                <p class="mb-1 text-sm font-medium">
                  {{ t('meetings.evalGestures') }}
                </p>
                <StarRating
                  v-model="forms[s.id]!.gestures"
                  :aria-label="t('meetings.evalGestures')"
                />
              </div>
            </div>

            <div class="mt-4 space-y-3">
              <div>
                <label
                  :for="`liked-${s.id}`"
                  class="text-sm font-medium"
                >{{ t('meetings.evalLiked') }}</label>
                <textarea
                  :id="`liked-${s.id}`"
                  v-model="forms[s.id]!.liked"
                  rows="2"
                  class="mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label
                  :for="`recommend-${s.id}`"
                  class="text-sm font-medium"
                >{{ t('meetings.evalRecommend') }}</label>
                <textarea
                  :id="`recommend-${s.id}`"
                  v-model="forms[s.id]!.recommend"
                  rows="2"
                  class="mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div
              v-if="forms[s.id]!.error"
              class="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {{ forms[s.id]!.error }}
            </div>

            <div class="mt-4 flex items-center gap-3">
              <Button
                :disabled="!canSubmit(s)"
                @click="submit(s)"
              >
                {{ forms[s.id]!.busy
                  ? t('meetings.evalSubmitting')
                  : hasMine(s) ? t('meetings.evalUpdate') : t('meetings.evalSubmit') }}
              </Button>
              <span
                v-if="forms[s.id]!.done"
                class="flex items-center gap-1.5 text-sm font-medium text-secondary"
              >
                <Check class="size-4" /> {{ t('meetings.evalSubmitted') }}
              </span>
            </div>
          </template>
        </section>
      </div>
    </template>
  </div>
</template>
