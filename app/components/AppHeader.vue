<script setup lang="ts">
import { LogOut, Menu, User } from '@lucide/vue'

const { setting } = useSettings()
const localePath = useLocalePath()
const { t } = useI18n()
const { loggedIn, user, clear } = useUserSession()

const open = ref(false)
const clubName = computed(() => setting('club.name', 'Toastily'))

// Site logo: the club's configured branding.logo_url (the official Toastmasters
// logo), falling back to a club-initial monogram when unset or missing.
const logoUrl = computed(() => setting('branding.logo_url', ''))
const logoFailed = ref(false)

// Functional nav for this phase. Meetings / Our Club / Contact arrive in
// later phases (PRD §5.2) and are added here as their pages ship.
const links = computed(() => [
  { to: localePath('/'), label: t('nav.home') },
  { to: localePath('/news'), label: t('nav.news') },
  { to: localePath('/meetings'), label: t('nav.meetings') },
])

const isMember = computed(() => hasMinRole(user.value?.status, 'member'))
const isOfficer = computed(() => hasMinRole(user.value?.status, 'officer'))
const { data: caps } = useCapabilities()
// Members/officers reach management through the Members & Executive hubs. A
// non-officer with a delegated calendar grant still needs a direct way in.
const calendarOnly = computed(() => !isOfficer.value && (caps.value?.canManageCalendar ?? false))

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
        <img
          v-if="logoUrl && !logoFailed"
          :src="logoUrl"
          alt=""
          class="h-10 w-auto"
          @error="logoFailed = true"
        >
        <span
          v-else
          class="grid size-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
        >
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
                v-if="isMember"
                as-child
              >
                <NuxtLink :to="localePath('/members')">{{ t('nav.membersArea') }}</NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="isOfficer"
                as-child
              >
                <NuxtLink :to="localePath('/executive')">{{ t('nav.executive') }}</NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="calendarOnly"
                as-child
              >
                <NuxtLink :to="localePath('/admin/meetings')">{{ t('admin.meetings.title') }}</NuxtLink>
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
                  v-if="isMember"
                  :to="localePath('/members')"
                  class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  @click="open = false"
                >
                  {{ t('nav.membersArea') }}
                </NuxtLink>
                <NuxtLink
                  v-if="isOfficer"
                  :to="localePath('/executive')"
                  class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  @click="open = false"
                >
                  {{ t('nav.executive') }}
                </NuxtLink>
                <NuxtLink
                  v-if="calendarOnly"
                  :to="localePath('/admin/meetings')"
                  class="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  @click="open = false"
                >
                  {{ t('admin.meetings.title') }}
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
