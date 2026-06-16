<script setup lang="ts">
import { BarChart3, Mail, Pin, Plus, Trash2, Wrench } from '@lucide/vue'

definePageMeta({ middleware: 'member' })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { user } = useUserSession()

const isOfficer = computed(() => hasMinRole(user.value?.status, 'officer'))

type Position = { nameEn: string, nameFr: string }
type Member = {
  id: string
  name: string
  email: string
  status: 'member' | 'officer' | 'admin'
  since: string
  positions: Position[]
}
type Message = {
  id: string
  body: string
  pinned: boolean
  expiresAt: string | null
  createdAt: string
  authorName: string | null
}

const { data } = await useFetch<{ members: Member[] }>('/api/members/roster', {
  key: 'members-roster',
  default: () => ({ members: [] }),
})

const members = computed(() => data.value?.members ?? [])

const { data: messageData, refresh: refreshMessages } = await useFetch<{ messages: Message[] }>(
  '/api/messages',
  { key: 'members-messages', default: () => ({ messages: [] }) },
)
const messages = computed(() => messageData.value?.messages ?? [])

// Officer compose form (hidden behind a button until opened)
const composing = ref(false)
const composeBody = ref('')
const composePinned = ref(false)
const composeExpiresAt = ref('')
const posting = ref(false)
const composeError = ref('')

const canPost = computed(() => composeBody.value.trim().length > 0 && !posting.value)

function openCompose() {
  composeError.value = ''
  composing.value = true
}

function cancelCompose() {
  composing.value = false
  composeBody.value = ''
  composePinned.value = false
  composeExpiresAt.value = ''
  composeError.value = ''
}

async function postMessage() {
  if (!canPost.value) return
  posting.value = true
  composeError.value = ''
  try {
    await $fetch('/api/messages', {
      method: 'POST',
      body: {
        body: composeBody.value.trim(),
        pinned: composePinned.value,
        expiresAt: composeExpiresAt.value || null,
      },
    })
    await refreshMessages()
    cancelCompose()
  }
  catch (e) {
    composeError.value = errorMessage(e, t('members.messages.error'))
  }
  finally {
    posting.value = false
  }
}

async function deleteMessage(id: string) {
  if (!window.confirm(t('members.messages.confirmDelete'))) return
  await $fetch(`/api/messages/${id}`, { method: 'DELETE' })
  await refreshMessages()
}

const statusLabel = (s: Member['status']) => t(`account.status${s.charAt(0).toUpperCase()}${s.slice(1)}`)
const positionLabel = (p: Position) => (locale.value === 'fr' ? p.nameFr : p.nameEn)

function fmt(date: string) {
  return new Date(date).toLocaleDateString(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long',
  })
}

function fmtDateTime(date: string) {
  return new Date(date).toLocaleDateString(locale.value === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

useHead(() => ({ title: t('members.title') }))
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12">
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('members.title') }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('members.subtitle') }}
      </p>
    </header>

    <!-- Member hub (PRD §7.1) -->
    <div class="mb-10 grid gap-4 sm:grid-cols-2">
      <NuxtLink :to="localePath('/participation')">
        <Card class="h-full transition-colors hover:border-primary/50 hover:bg-muted/40">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-base">
              <BarChart3 class="size-4" /> {{ t('participation.title') }}
            </CardTitle>
            <CardDescription>{{ t('participation.cardHint') }}</CardDescription>
          </CardHeader>
        </Card>
      </NuxtLink>
      <Card class="opacity-70">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <Wrench class="size-4" /> {{ t('members.tools.title') }}
          </CardTitle>
          <CardDescription>{{ t('members.tools.soon') }}</CardDescription>
        </CardHeader>
      </Card>
    </div>

    <!-- Announcements (PRD §7.1, issue #17) -->
    <section class="mb-10">
      <h2 class="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
        <Mail class="size-5" /> {{ t('members.messages.title') }}
      </h2>

      <!-- Officer: button to reveal the compose form -->
      <div
        v-if="isOfficer && !composing"
        class="mb-4"
      >
        <Button
          variant="outline"
          @click="openCompose"
        >
          <Plus class="size-4" /> {{ t('members.messages.addButton') }}
        </Button>
      </div>

      <!-- Officer compose form -->
      <Card
        v-if="isOfficer && composing"
        class="mb-4"
      >
        <CardHeader>
          <CardTitle class="text-base">
            {{ t('members.messages.compose') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <textarea
            v-model="composeBody"
            :placeholder="t('members.messages.placeholder')"
            rows="3"
            class="placeholder:text-muted-foreground dark:bg-input/30 border-input min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="composePinned"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
              >
              {{ t('members.messages.pin') }}
            </label>
            <label class="flex items-center gap-2 text-sm">
              <span class="text-muted-foreground">{{ t('members.messages.expires') }}</span>
              <Input
                v-model="composeExpiresAt"
                type="date"
                class="h-8 w-auto"
              />
            </label>
          </div>
          <p
            v-if="composeError"
            class="text-sm text-destructive"
          >
            {{ composeError }}
          </p>
          <div class="flex justify-end gap-2">
            <Button
              variant="ghost"
              :disabled="posting"
              @click="cancelCompose"
            >
              {{ t('common.cancel') }}
            </Button>
            <Button
              :disabled="!canPost"
              @click="postMessage"
            >
              {{ posting ? t('members.messages.posting') : t('members.messages.post') }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Empty state -->
      <Card
        v-if="!messages.length"
        class="opacity-70"
      >
        <CardHeader>
          <CardDescription>{{ t('members.messages.empty') }}</CardDescription>
        </CardHeader>
      </Card>

      <!-- Message list -->
      <ul
        v-else
        class="space-y-3"
      >
        <li
          v-for="msg in messages"
          :key="msg.id"
        >
          <Card :class="msg.pinned ? 'border-primary/50' : ''">
            <CardHeader class="flex-row items-start justify-between gap-4 space-y-0">
              <div class="min-w-0">
                <p class="whitespace-pre-wrap break-words text-sm">
                  {{ msg.body }}
                </p>
                <CardDescription class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge
                    v-if="msg.pinned"
                    variant="secondary"
                    class="gap-1"
                  >
                    <Pin class="size-3" /> {{ t('members.messages.pinned') }}
                  </Badge>
                  <span>{{ msg.authorName ?? '—' }}</span>
                  <span>· {{ fmtDateTime(msg.createdAt) }}</span>
                  <span v-if="msg.expiresAt">· {{ t('members.messages.expiresOn', { date: fmtDateTime(msg.expiresAt) }) }}</span>
                </CardDescription>
              </div>
              <Button
                v-if="isOfficer"
                variant="ghost"
                size="icon"
                :aria-label="t('members.messages.delete')"
                @click="deleteMessage(msg.id)"
              >
                <Trash2 class="size-4" />
              </Button>
            </CardHeader>
          </Card>
        </li>
      </ul>
    </section>

    <!-- Roster (PRD §7.1) -->
    <section>
      <h2 class="mb-4 text-xl font-semibold tracking-tight">
        {{ t('members.roster.title') }}
        <span class="text-base font-normal text-muted-foreground">({{ members.length }})</span>
      </h2>

      <ul class="space-y-3">
        <li
          v-for="m in members"
          :key="m.id"
        >
          <Card>
            <CardHeader class="flex-row items-start justify-between gap-4 space-y-0">
              <div class="min-w-0">
                <CardTitle class="text-base">
                  <NuxtLink
                    :to="localePath(`/participation/${m.id}`)"
                    class="hover:underline"
                  >
                    {{ m.name }}
                  </NuxtLink>
                </CardTitle>
                <CardDescription class="truncate">
                  <a
                    :href="`mailto:${m.email}`"
                    class="hover:underline"
                  >{{ m.email }}</a>
                  · {{ t('members.roster.since', { date: fmt(m.since) }) }}
                </CardDescription>
                <div
                  v-if="m.positions.length"
                  class="mt-2 flex flex-wrap gap-1.5"
                >
                  <Badge
                    v-for="p in m.positions"
                    :key="p.nameEn"
                    variant="secondary"
                  >
                    {{ positionLabel(p) }}
                  </Badge>
                </div>
              </div>
              <Badge :variant="m.status === 'member' ? 'outline' : 'default'">
                {{ statusLabel(m.status) }}
              </Badge>
            </CardHeader>
          </Card>
        </li>
      </ul>
    </section>
  </div>
</template>
