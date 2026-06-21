<script setup lang="ts">
import { ArrowUpRight, CalendarDays, FileText, ImageUp, ListChecks, Mail, Newspaper, Quote, Settings, ShieldCheck, Users, UserSquare } from '@lucide/vue'

definePageMeta({ middleware: 'officer' })

const { t } = useI18n()
const localePath = useLocalePath()
const { user } = useUserSession()
const { data: caps } = useCapabilities()

const isAdmin = computed(() => hasMinRole(user.value?.status, 'admin'))
const isOfficer = computed(() => hasMinRole(user.value?.status, 'officer'))

// Pending membership-request count, surfaced as a badge on the Requests card
// (issue #50). Officer-gated endpoint; refreshes when the hub is revisited.
const { data: requestCount } = await useFetch<{ pending: number }>('/api/membership/requests/count', {
  key: 'membership-requests-count',
  default: () => ({ pending: 0 }),
})
const pendingRequests = computed(() => requestCount.value?.pending ?? 0)

// Each tool surfaces an existing management page, gated by the capability the
// server already enforces. Authority is data (capabilities), not a position
// name (CLAUDE.md). Hidden when the user lacks the capability. Tools are
// organised into functional groups; a group renders only when it has at least
// one visible tool.
const tools = computed(() => [
  {
    key: 'requests',
    group: 'people',
    icon: Users,
    to: localePath('/membership/requests'),
    title: t('nav.requests'),
    desc: t('executive.tools.requests'),
    show: isOfficer.value,
    badge: pendingRequests.value,
  },
  {
    key: 'executives',
    group: 'people',
    icon: UserSquare,
    to: localePath('/admin/executives'),
    title: t('admin.executives.title'),
    desc: t('executive.tools.executives'),
    show: isAdmin.value || (caps.value?.canAssignOfficers ?? false),
  },
  {
    key: 'permissions',
    group: 'people',
    icon: ShieldCheck,
    to: localePath('/admin/permission-grants'),
    title: t('admin.permissions.title'),
    desc: t('executive.tools.permissions'),
    show: isAdmin.value || (caps.value?.canAssignOfficers ?? false),
  },
  {
    key: 'meetings',
    group: 'meetings',
    icon: CalendarDays,
    to: localePath('/admin/meetings'),
    title: t('admin.meetings.title'),
    desc: t('executive.tools.meetings'),
    show: caps.value?.canManageCalendar ?? false,
  },
  {
    key: 'roles',
    group: 'meetings',
    icon: ListChecks,
    to: localePath('/admin/meeting-roles'),
    title: t('admin.roles.title'),
    desc: t('executive.tools.roles'),
    show: isAdmin.value,
  },
  {
    key: 'agenda',
    group: 'meetings',
    icon: FileText,
    to: localePath('/admin/agenda-template'),
    title: t('admin.agenda.title'),
    desc: t('executive.tools.agenda'),
    show: isAdmin.value,
  },
  {
    key: 'news',
    group: 'content',
    icon: Newspaper,
    to: localePath('/admin/news'),
    title: t('admin.news.title'),
    desc: t('executive.tools.news'),
    show: caps.value?.canManageContent ?? false,
  },
  {
    key: 'testimonials',
    group: 'content',
    icon: Quote,
    to: localePath('/admin/testimonials'),
    title: t('admin.testimonials.title'),
    desc: t('executive.tools.testimonials'),
    show: caps.value?.canManageContent ?? false,
  },
  {
    key: 'uploads',
    group: 'content',
    icon: ImageUp,
    to: localePath('/admin/uploads'),
    title: t('admin.uploads.title'),
    desc: t('executive.tools.uploads'),
    show: caps.value?.canManageContent ?? false,
  },
  {
    key: 'notifications',
    group: 'communication',
    icon: Mail,
    to: localePath('/admin/notifications'),
    title: t('admin.notifications.title'),
    desc: t('executive.tools.notifications'),
    // Communication managers get the full page; calendar (agenda) managers reach
    // it to configure the signup reminder (issue #59).
    show: isAdmin.value || (caps.value?.canManageCommunication ?? false) || (caps.value?.canManageCalendar ?? false),
  },
  {
    key: 'settings',
    group: 'config',
    icon: Settings,
    to: localePath('/admin/settings'),
    title: t('admin.settings'),
    desc: t('executive.tools.settings'),
    show: isAdmin.value || (caps.value?.canManageConfig ?? false),
  },
].filter(tool => tool.show))

// Per-group colour identity, drawn entirely from the official Toastmasters
// brand kit (maroon · navy · gold · gray — see app/assets/css/tailwind.css).
// Full class strings (not constructed) so Tailwind's JIT picks them up.
const GROUP_META = {
  // Membership & people — Loyal Maroon
  people: {
    tile: 'from-tm-maroon to-tm-maroon-deep shadow-tm-maroon/30',
    iconText: 'text-white',
    label: 'text-tm-maroon dark:text-tm-maroon-bright',
    glow: 'bg-tm-maroon/25',
    border: 'group-hover:border-tm-maroon/50',
    shadow: 'group-hover:shadow-tm-maroon/25',
  },
  // Meetings & agenda — True Blue
  meetings: {
    tile: 'from-tm-navy to-tm-navy-deep shadow-tm-navy/30',
    iconText: 'text-white',
    label: 'text-tm-navy dark:text-tm-navy-bright',
    glow: 'bg-tm-navy/25',
    border: 'group-hover:border-tm-navy/50',
    shadow: 'group-hover:shadow-tm-navy/25',
  },
  // Content — Happy Yellow (navy icon, per the brand gold+navy pairing)
  content: {
    tile: 'from-tm-gold to-tm-gold-deep shadow-tm-gold/40',
    iconText: 'text-tm-navy',
    label: 'text-tm-gold-deep dark:text-tm-gold',
    glow: 'bg-tm-gold/40',
    border: 'group-hover:border-tm-gold/70',
    shadow: 'group-hover:shadow-tm-gold/30',
  },
  // Communication — the signature maroon→navy blend
  communication: {
    tile: 'from-tm-maroon via-tm-maroon-deep to-tm-navy shadow-tm-navy/30',
    iconText: 'text-white',
    label: 'text-tm-navy dark:text-tm-navy-bright',
    glow: 'bg-tm-navy/25',
    border: 'group-hover:border-tm-navy/50',
    shadow: 'group-hover:shadow-tm-navy/25',
  },
  // Configuration — Cool Gray
  config: {
    tile: 'from-tm-gray-deep to-tm-gray-darker shadow-tm-gray/40',
    iconText: 'text-white',
    label: 'text-tm-gray-deep dark:text-tm-gray',
    glow: 'bg-tm-gray/30',
    border: 'group-hover:border-tm-gray/60',
    shadow: 'group-hover:shadow-tm-gray/25',
  },
} as const

// Ordered group definitions; each renders only if it has visible tools. A
// running index drives the staggered load-in across all cards on the page.
const GROUP_ORDER = ['people', 'meetings', 'content', 'communication', 'config'] as const

const groups = computed(() => {
  let order = 0
  return GROUP_ORDER
    .map(key => ({
      key,
      label: t(`executive.groups.${key}`),
      meta: GROUP_META[key],
      tools: tools.value.filter(tool => tool.group === key),
    }))
    .filter(group => group.tools.length > 0)
    .map(group => ({
      ...group,
      tools: group.tools.map(tool => ({ ...tool, delay: order++ * 55 })),
    }))
})

useHead(() => ({ title: t('executive.title') }))
</script>

<template>
  <div class="relative mx-auto max-w-5xl px-4 py-12">
    <!-- Ambient colour wash behind the header -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-72 overflow-hidden"
    >
      <div class="absolute left-1/4 top-0 size-72 -translate-x-1/2 rounded-full bg-tm-maroon/15 blur-3xl" />
      <div class="absolute right-1/4 top-4 size-72 translate-x-1/2 rounded-full bg-tm-navy/15 blur-3xl" />
      <div class="absolute left-1/2 top-10 size-72 -translate-x-1/2 rounded-full bg-tm-gold/20 blur-3xl" />
    </div>

    <header class="mb-10 animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500">
      <span class="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur">
        <span class="size-2 animate-pulse rounded-full bg-linear-to-br from-tm-maroon to-tm-navy" />
        {{ t('executive.kicker') }}
      </span>
      <h1 class="mt-4 bg-linear-to-r from-tm-maroon via-tm-maroon-bright to-tm-navy bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
        {{ t('executive.title') }}
      </h1>
      <p class="mt-3 max-w-2xl text-base text-muted-foreground">
        {{ t('executive.subtitle') }}
      </p>
    </header>

    <section
      v-for="group in groups"
      :key="group.key"
      class="mb-10 last:mb-0"
    >
      <h2
        class="mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest"
        :class="group.meta.label"
      >
        <span
          class="size-2.5 rounded-full bg-linear-to-br"
          :class="group.meta.tile"
        />
        {{ group.label }}
        <span class="ml-1 h-px flex-1 bg-linear-to-r from-border to-transparent" />
      </h2>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="tool in group.tools"
          :key="tool.key"
          :to="tool.to"
          :style="{ animationDelay: `${tool.delay}ms` }"
          class="group relative animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div
            class="relative h-full overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl"
            :class="[group.meta.border, group.meta.shadow]"
          >
            <!-- colour glow that warms up on hover -->
            <div
              aria-hidden="true"
              class="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
              :class="group.meta.glow"
            />

            <div class="relative flex items-start gap-4">
              <div
                class="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br shadow-lg transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
                :class="[group.meta.tile, group.meta.iconText]"
              >
                <component
                  :is="tool.icon"
                  class="size-5"
                />
                <span
                  v-if="tool.badge"
                  class="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold leading-5 text-destructive-foreground shadow ring-2 ring-card"
                  :aria-label="t('executive.tools.requestsPending', { count: tool.badge })"
                >
                  {{ tool.badge }}
                </span>
              </div>
              <div class="min-w-0">
                <h3 class="font-semibold leading-tight text-foreground">
                  {{ tool.title }}
                </h3>
                <p class="mt-1 text-sm leading-snug text-muted-foreground">
                  {{ tool.desc }}
                </p>
              </div>
            </div>

            <ArrowUpRight
              aria-hidden="true"
              class="absolute bottom-4 right-4 size-4 -translate-x-1 translate-y-1 text-muted-foreground/60 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
              :class="group.meta.label"
            />
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
