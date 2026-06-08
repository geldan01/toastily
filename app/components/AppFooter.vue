<script setup lang="ts">
import { Clock, Mail, MapPin } from '@lucide/vue'

const { setting } = useSettings()
const { locale, t } = useI18n()

const clubName = computed(() => setting('club.name', 'Toastily'))
const meetingDay = computed(() => setting(locale.value === 'fr' ? 'meeting.day_fr' : 'meeting.day_en'))
const meetingTime = computed(() => setting('meeting.time'))
const address = computed(() => setting('meeting.address'))
const locationNote = computed(() => setting(locale.value === 'fr' ? 'meeting.location_note_fr' : 'meeting.location_note_en'))
const email = computed(() => setting('club.email'))
const year = new Date().getFullYear()

// Toastmasters club identity line — only the parts that are set are shown.
const identityParts = computed(() => [
  setting('club.number') && `${t('footer.club')} ${setting('club.number')}`,
  setting('club.area') && `${t('footer.area')} ${setting('club.area')}`,
  setting('club.division') && `${t('footer.division')} ${setting('club.division')}`,
  setting('club.district') && `${t('footer.district')} ${setting('club.district')}`,
].filter(Boolean) as string[])
</script>

<template>
  <footer class="mt-16 border-t border-border bg-muted/40 print:hidden">
    <div class="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <div class="text-lg font-semibold text-primary">
          {{ clubName }}
        </div>
        <p
          v-if="identityParts.length"
          class="mt-2 text-sm text-muted-foreground"
        >
          {{ identityParts.join(' · ') }}
        </p>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ $t('footer.poweredBy') }}
        </p>
      </div>

      <div>
        <h3 class="text-sm font-semibold">
          {{ $t('footer.whenWhere') }}
        </h3>
        <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
          <li
            v-if="meetingDay || meetingTime"
            class="flex items-start gap-2"
          >
            <Clock class="mt-0.5 size-4 shrink-0 text-secondary" />
            <span>{{ [meetingDay, meetingTime].filter(Boolean).join(' · ') }}</span>
          </li>
          <li
            v-if="address"
            class="flex items-start gap-2"
          >
            <MapPin class="mt-0.5 size-4 shrink-0 text-secondary" />
            <span>{{ address }}<template v-if="locationNote"><br>{{ locationNote }}</template></span>
          </li>
        </ul>
      </div>

      <div>
        <h3 class="text-sm font-semibold">
          {{ $t('footer.contact') }}
        </h3>
        <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
          <li
            v-if="email"
            class="flex items-center gap-2"
          >
            <Mail class="size-4 shrink-0 text-secondary" />
            <a
              :href="`mailto:${email}`"
              class="hover:text-foreground"
            >{{ email }}</a>
          </li>
        </ul>
      </div>
    </div>

    <div class="border-t border-border py-4">
      <p class="mx-auto max-w-6xl px-4 text-xs text-muted-foreground">
        © {{ year }} {{ clubName }}. {{ $t('footer.rights') }}
      </p>
    </div>
  </footer>
</template>
