<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { t } = useI18n()

type Me = {
  name: string
  email: string
  status: 'guest' | 'member' | 'officer' | 'admin'
  avatarUrl: string | null
  membershipRequestStatus: string | null
}

const { data: me, refresh } = await useFetch<Me>('/api/auth/me', { key: 'account-me' })

// Profile picture (issue #43). Members+ can upload/replace/remove their own.
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarBusy = ref(false)
const avatarError = ref('')

function pickAvatar() {
  avatarError.value = ''
  avatarInput.value?.click()
}

async function uploadAvatar(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  avatarBusy.value = true
  avatarError.value = ''
  try {
    const form = new FormData()
    form.append('file', file)
    await $fetch('/api/me/avatar', { method: 'POST', body: form })
    await refresh()
  }
  catch (err) {
    avatarError.value = errorMessage(err, t('auth.genericError'))
  }
  finally {
    avatarBusy.value = false
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

async function removeAvatar() {
  avatarBusy.value = true
  avatarError.value = ''
  try {
    await $fetch('/api/me/avatar', { method: 'DELETE' })
    await refresh()
  }
  catch (err) {
    avatarError.value = errorMessage(err, t('auth.genericError'))
  }
  finally {
    avatarBusy.value = false
  }
}

const message = ref('')
const submitting = ref(false)
const sent = ref(false)
const confirming = ref(false)

const isGuest = computed(() => me.value?.status === 'guest')
const hasPending = computed(() => me.value?.membershipRequestStatus === 'pending')

// Member testimonial (issue #27). Members+ may share a testimonial in either or
// both languages; a content curator may feature it publicly on the home page.
interface Testimonial {
  bodyEn: string | null
  bodyFr: string | null
  featuredEn: boolean
  featuredFr: boolean
}

const { data: testimonial, refresh: refreshTestimonial } = await useFetch<Testimonial>(
  '/api/me/testimonial',
  { key: 'me-testimonial' },
)
const testimonialForm = reactive({
  bodyEn: testimonial.value?.bodyEn ?? '',
  bodyFr: testimonial.value?.bodyFr ?? '',
})
const savingTestimonial = ref(false)
const savedTestimonial = ref(false)
const testimonialError = ref('')

async function saveTestimonial() {
  savingTestimonial.value = true
  savedTestimonial.value = false
  testimonialError.value = ''
  try {
    await $fetch('/api/me/testimonial', {
      method: 'PUT',
      body: { bodyEn: testimonialForm.bodyEn, bodyFr: testimonialForm.bodyFr },
    })
    savedTestimonial.value = true
    setTimeout(() => (savedTestimonial.value = false), 1500)
    await refreshTestimonial()
  }
  catch (e) {
    testimonialError.value = errorMessage(e, t('auth.genericError'))
  }
  finally {
    savingTestimonial.value = false
  }
}

const statusLabel = computed(() => {
  switch (me.value?.status) {
    case 'admin': return t('account.statusAdmin')
    case 'officer': return t('account.statusOfficer')
    case 'member': return t('account.statusMember')
    default: return t('account.statusGuest')
  }
})

async function requestMembership() {
  submitting.value = true
  try {
    await $fetch('/api/membership/request', { method: 'POST', body: { message: message.value } })
    sent.value = true
    confirming.value = false
    await refresh()
  }
  finally {
    submitting.value = false
  }
}

function cancelRequest() {
  confirming.value = false
  message.value = ''
}

useHead(() => ({ title: t('account.title') }))
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight">
      {{ t('account.title') }}
    </h1>

    <Card class="mt-8">
      <CardHeader class="flex-row items-center gap-4 space-y-0">
        <MemberAvatar
          :name="me?.name ?? ''"
          :src="me?.avatarUrl"
          :size="64"
        />
        <div class="min-w-0">
          <CardTitle>{{ me?.name }}</CardTitle>
          <CardDescription>{{ me?.email }}</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">{{ t('account.status') }}:</span>
          <Badge>{{ statusLabel }}</Badge>
        </div>

        <!-- Profile picture controls (issue #43): members+ only -->
        <div
          v-if="!isGuest"
          class="space-y-2 border-t pt-4"
        >
          <p class="text-sm font-medium">
            {{ t('account.avatar.title') }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ t('account.avatar.hint') }}
          </p>
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="uploadAvatar"
          >
          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="avatarBusy"
              @click="pickAvatar"
            >
              {{ avatarBusy ? t('account.avatar.uploading') : (me?.avatarUrl ? t('account.avatar.change') : t('account.avatar.upload')) }}
            </Button>
            <Button
              v-if="me?.avatarUrl"
              variant="ghost"
              size="sm"
              :disabled="avatarBusy"
              @click="removeAvatar"
            >
              {{ t('account.avatar.remove') }}
            </Button>
          </div>
          <p
            v-if="avatarError"
            class="text-sm text-destructive"
          >
            {{ avatarError }}
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- Guests can request membership -->
    <Card
      v-if="isGuest"
      class="mt-6"
    >
      <CardHeader>
        <CardTitle class="text-lg">
          {{ t('account.requestMembership') }}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          v-if="hasPending"
          class="text-sm text-muted-foreground"
        >
          {{ t('account.requestPending') }}
        </p>
        <p
          v-else-if="sent"
          class="text-sm"
        >
          {{ t('account.requestSent') }}
        </p>
        <div
          v-else
          class="space-y-4"
        >
          <p class="text-sm text-muted-foreground">
            {{ t('account.requestExplanation') }}
          </p>
          <Button
            v-if="!confirming"
            @click="confirming = true"
          >
            {{ t('account.requestMembership') }}
          </Button>
          <form
            v-else
            class="space-y-4"
            @submit.prevent="requestMembership"
          >
            <div class="space-y-2">
              <Label for="msg">{{ t('account.requestMessage') }}</Label>
              <Input
                id="msg"
                v-model="message"
              />
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                type="submit"
                :disabled="submitting"
              >
                {{ t('account.requestConfirm') }}
              </Button>
              <Button
                type="button"
                variant="outline"
                :disabled="submitting"
                @click="cancelRequest"
              >
                {{ t('account.requestCancel') }}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>

    <p
      v-else
      class="mt-6 text-sm text-muted-foreground"
    >
      {{ t('account.memberInfo') }}
    </p>

    <!-- Member testimonial (issue #27): members+ only -->
    <Card
      v-if="!isGuest"
      class="mt-6"
    >
      <CardHeader>
        <CardTitle class="text-lg">
          {{ t('account.testimonial.title') }}
        </CardTitle>
        <CardDescription>{{ t('account.testimonial.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <Label for="testimonialEn">{{ t('account.testimonial.english') }}</Label>
            <Badge
              v-if="testimonial?.featuredEn"
              variant="secondary"
            >
              {{ t('account.testimonial.featured') }}
            </Badge>
          </div>
          <textarea
            id="testimonialEn"
            v-model="testimonialForm.bodyEn"
            rows="4"
            :placeholder="t('account.testimonial.placeholder')"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <Label for="testimonialFr">{{ t('account.testimonial.french') }}</Label>
            <Badge
              v-if="testimonial?.featuredFr"
              variant="secondary"
            >
              {{ t('account.testimonial.featured') }}
            </Badge>
          </div>
          <textarea
            id="testimonialFr"
            v-model="testimonialForm.bodyFr"
            rows="4"
            :placeholder="t('account.testimonial.placeholder')"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <p
          v-if="testimonialError"
          class="text-sm text-destructive"
        >
          {{ testimonialError }}
        </p>

        <Button
          :disabled="savingTestimonial"
          @click="saveTestimonial"
        >
          {{ savedTestimonial ? t('account.testimonial.saved') : t('account.testimonial.save') }}
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
