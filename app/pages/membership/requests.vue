<script setup lang="ts">
definePageMeta({ middleware: 'officer' })

const { t, locale } = useI18n()

type Request = {
  id: string
  name: string
  email: string
  message: string | null
  createdAt: string
}

const { data: requests, refresh } = await useFetch<Request[]>('/api/membership/requests', {
  key: 'membership-requests',
  default: () => [],
})

const busy = ref<string | null>(null)

async function decide(id: string, action: 'approve' | 'decline') {
  busy.value = id
  try {
    await $fetch(`/api/membership/requests/${id}/${action}`, { method: 'POST' })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

useHead(() => ({ title: t('requests.title') }))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-3xl font-bold tracking-tight">
      {{ t('requests.title') }}
    </h1>

    <p
      v-if="!requests.length"
      class="mt-8 text-muted-foreground"
    >
      {{ t('requests.empty') }}
    </p>

    <ul
      v-else
      class="mt-8 space-y-4"
    >
      <li
        v-for="r in requests"
        :key="r.id"
      >
        <Card>
          <CardHeader>
            <CardTitle class="text-base">
              {{ r.name }}
            </CardTitle>
            <CardDescription>{{ r.email }} · {{ t('requests.requestedOn', { date: fmt(r.createdAt) }) }}</CardDescription>
          </CardHeader>
          <CardContent
            v-if="r.message"
            class="text-sm text-muted-foreground"
          >
            {{ r.message }}
          </CardContent>
          <CardFooter class="gap-2">
            <Button
              size="sm"
              :disabled="busy === r.id"
              @click="decide(r.id, 'approve')"
            >
              {{ t('requests.approve') }}
            </Button>
            <Button
              size="sm"
              variant="outline"
              :disabled="busy === r.id"
              @click="decide(r.id, 'decline')"
            >
              {{ t('requests.decline') }}
            </Button>
          </CardFooter>
        </Card>
      </li>
    </ul>
  </div>
</template>
