<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { t } = useI18n()

type Me = {
  name: string
  email: string
  status: 'guest' | 'member' | 'officer' | 'admin'
  membershipRequestStatus: string | null
}

const { data: me, refresh } = await useFetch<Me>('/api/auth/me', { key: 'account-me' })

const message = ref('')
const submitting = ref(false)
const sent = ref(false)

const statusLabel = computed(() => {
  switch (me.value?.status) {
    case 'admin': return t('account.statusAdmin')
    case 'officer': return t('account.statusOfficer')
    case 'member': return t('account.statusMember')
    default: return t('account.statusGuest')
  }
})

const isGuest = computed(() => me.value?.status === 'guest')
const hasPending = computed(() => me.value?.membershipRequestStatus === 'pending')

async function requestMembership() {
  submitting.value = true
  try {
    await $fetch('/api/membership/request', { method: 'POST', body: { message: message.value } })
    sent.value = true
    await refresh()
  }
  finally {
    submitting.value = false
  }
}

useHead(() => ({ title: t('account.title') }))
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight">
      {{ t('account.title') }}
    </h1>

    <Card class="mt-8">
      <CardHeader>
        <CardTitle>{{ me?.name }}</CardTitle>
        <CardDescription>{{ me?.email }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-2">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">{{ t('account.status') }}:</span>
          <Badge>{{ statusLabel }}</Badge>
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
          <Button
            type="submit"
            :disabled="submitting"
          >
            {{ t('account.requestMembership') }}
          </Button>
        </form>
      </CardContent>
    </Card>

    <p
      v-else
      class="mt-6 text-sm text-muted-foreground"
    >
      {{ t('account.memberInfo') }}
    </p>
  </div>
</template>
