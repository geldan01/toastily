<script setup lang="ts">
import { LogOut, Menu, User } from '@lucide/vue'

const { setting } = useSettings()
const localePath = useLocalePath()
const { t } = useI18n()
const { loggedIn, user, clear } = useUserSession()

const open = ref(false)
const clubName = computed(() => setting('club.name', 'Toastily'))

// Functional nav for this phase. Meetings / Our Club / Contact arrive in
// later phases (PRD §5.2) and are added here as their pages ship.
const links = computed(() => [
  { to: localePath('/'), label: t('nav.home') },
  { to: localePath('/news'), label: t('nav.news') },
  { to: localePath('/meetings'), label: t('nav.meetings') },
])

const canReviewRequests = computed(() => hasMinRole(user.value?.status, 'officer'))
const canManageSettings = computed(() => hasMinRole(user.value?.status, 'admin'))
const { data: caps } = useCapabilities()
const canManageCalendar = computed(() => caps.value?.canManageCalendar ?? false)

async function logout() {
  await clear()
  open.value = false
  await navigateTo(localePath('/'))
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur print:hidden">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
      <NuxtLink
        :to="localePath('/')"
        class="flex items-center gap-2 font-semibold text-primary"
      >
        <span class="grid size-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          {{ clubName.charAt(0) }}
        </span>
        <span class="truncate text-base">{{ clubName }}</span>
      </NuxtLink>

      <!-- Desktop nav -->
      <nav class="hidden items-center gap-1 md:flex">
        <Button
          v-for="link in links"
          :key="link.to"
          as-child
          variant="ghost"
          size="sm"
        >
          <NuxtLink :to="link.to">{{ link.label }}</NuxtLink>
        </Button>
      </nav>

      <div class="flex items-center gap-1">
        <LangToggle />

        <!-- Account (desktop) -->
        <div class="hidden md:block">
          <DropdownMenu v-if="loggedIn">
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="gap-1.5"
              >
                <User class="size-4" />
                <span class="max-w-32 truncate">{{ user?.name }}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem as-child>
                <NuxtLink :to="localePath('/account')">{{ t('nav.account') }}</NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canReviewRequests"
                as-child
              >
                <NuxtLink :to="localePath('/membership/requests')">{{ t('nav.requests') }}</NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canManageCalendar"
                as-child
              >
                <NuxtLink :to="localePath('/admin/meetings')">{{ t('admin.meetings.title') }}</NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canManageSettings"
                as-child
              >
                <NuxtLink :to="localePath('/admin/executives')">{{ t('admin.executives.title') }}</NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canManageSettings"
                as-child
              >
                <NuxtLink :to="localePath('/admin/meeting-roles')">{{ t('admin.roles.title') }}</NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canManageSettings"
                as-child
              >
                <NuxtLink :to="localePath('/admin/agenda-template')">{{ t('admin.agenda.title') }}</NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canReviewRequests"
                as-child
              >
                <NuxtLink :to="localePath('/admin/notifications')">{{ t('admin.notifications.title') }}</NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canManageSettings"
                as-child
              >
                <NuxtLink :to="localePath('/admin/settings')">{{ t('admin.settings') }}</NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="logout">
                <LogOut class="size-4" />
                {{ t('nav.logout') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            v-else
            as-child
            variant="default"
            size="sm"
          >
            <NuxtLink :to="localePath('/login')">{{ t('nav.login') }}</NuxtLink>
          </Button>
        </div>

        <!-- Mobile menu -->
        <Sheet v-model:open="open">
          <SheetTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="md:hidden"
              :aria-label="$t('nav.menu')"
            >
              <Menu class="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            class="w-72"
          >
            <SheetHeader>
              <SheetTitle class="text-primary">
                {{ clubName }}
              </SheetTitle>
            </SheetHeader>
            <nav class="mt-4 flex flex-col gap-1 px-2">
              <NuxtLink
                v-for="link in links"
                :key="link.to"
                :to="link.to"
                class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                @click="open = false"
              >
                {{ link.label }}
              </NuxtLink>

              <Separator class="my-2" />

              <template v-if="loggedIn">
                <NuxtLink
                  :to="localePath('/account')"
                  class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  @click="open = false"
                >
                  {{ t('nav.account') }}
                </NuxtLink>
                <NuxtLink
                  v-if="canReviewRequests"
                  :to="localePath('/membership/requests')"
                  class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  @click="open = false"
                >
                  {{ t('nav.requests') }}
                </NuxtLink>
                <NuxtLink
                  v-if="canManageCalendar"
                  :to="localePath('/admin/meetings')"
                  class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  @click="open = false"
                >
                  {{ t('admin.meetings.title') }}
                </NuxtLink>
                <NuxtLink
                  v-if="canManageSettings"
                  :to="localePath('/admin/executives')"
                  class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  @click="open = false"
                >
                  {{ t('admin.executives.title') }}
                </NuxtLink>
                <NuxtLink
                  v-if="canManageSettings"
                  :to="localePath('/admin/meeting-roles')"
                  class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  @click="open = false"
                >
                  {{ t('admin.roles.title') }}
                </NuxtLink>
                <NuxtLink
                  v-if="canManageSettings"
                  :to="localePath('/admin/agenda-template')"
                  class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  @click="open = false"
                >
                  {{ t('admin.agenda.title') }}
                </NuxtLink>
                <NuxtLink
                  v-if="canReviewRequests"
                  :to="localePath('/admin/notifications')"
                  class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  @click="open = false"
                >
                  {{ t('admin.notifications.title') }}
                </NuxtLink>
                <NuxtLink
                  v-if="canManageSettings"
                  :to="localePath('/admin/settings')"
                  class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  @click="open = false"
                >
                  {{ t('admin.settings') }}
                </NuxtLink>
                <button
                  type="button"
                  class="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                  @click="logout"
                >
                  {{ t('nav.logout') }}
                </button>
              </template>
              <NuxtLink
                v-else
                :to="localePath('/login')"
                class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                @click="open = false"
              >
                {{ t('nav.login') }}
              </NuxtLink>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  </header>
</template>
