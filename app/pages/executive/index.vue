<script setup lang="ts">
import { CalendarDays, FileText, ImageUp, ListChecks, Mail, Newspaper, Quote, Settings, ShieldCheck, Users, UserSquare } from '@lucide/vue'

definePageMeta({ middleware: 'officer' })

const { t } = useI18n()
const localePath = useLocalePath()
const { user } = useUserSession()
const { data: caps } = useCapabilities()

const isAdmin = computed(() => hasMinRole(user.value?.status, 'admin'))
const isOfficer = computed(() => hasMinRole(user.value?.status, 'officer'))

// Each tool surfaces an existing management page, gated by the capability the
// server already enforces. Authority is data (capabilities), not a position
// name (CLAUDE.md). Hidden when the user lacks the capability.
const tools = computed(() => [
  {
    key: 'requests',
    icon: Users,
    to: localePath('/membership/requests'),
    title: t('nav.requests'),
    desc: t('executive.tools.requests'),
    show: isOfficer.value,
  },
  {
    key: 'news',
    icon: Newspaper,
    to: localePath('/admin/news'),
    title: t('admin.news.title'),
    desc: t('executive.tools.news'),
    show: caps.value?.canManageContent ?? false,
  },
  {
    key: 'testimonials',
    icon: Quote,
    to: localePath('/admin/testimonials'),
    title: t('admin.testimonials.title'),
    desc: t('executive.tools.testimonials'),
    show: caps.value?.canManageContent ?? false,
  },
  {
    key: 'meetings',
    icon: CalendarDays,
    to: localePath('/admin/meetings'),
    title: t('admin.meetings.title'),
    desc: t('executive.tools.meetings'),
    show: caps.value?.canManageCalendar ?? false,
  },
  {
    key: 'notifications',
    icon: Mail,
    to: localePath('/admin/notifications'),
    title: t('admin.notifications.title'),
    desc: t('executive.tools.notifications'),
    show: isOfficer.value,
  },
  {
    key: 'executives',
    icon: UserSquare,
    to: localePath('/admin/executives'),
    title: t('admin.executives.title'),
    desc: t('executive.tools.executives'),
    show: isAdmin.value || (caps.value?.canAssignOfficers ?? false),
  },
  {
    key: 'permissions',
    icon: ShieldCheck,
    to: localePath('/admin/permission-grants'),
    title: t('admin.permissions.title'),
    desc: t('executive.tools.permissions'),
    show: isAdmin.value || (caps.value?.canAssignOfficers ?? false),
  },
  {
    key: 'roles',
    icon: ListChecks,
    to: localePath('/admin/meeting-roles'),
    title: t('admin.roles.title'),
    desc: t('executive.tools.roles'),
    show: isAdmin.value,
  },
  {
    key: 'agenda',
    icon: FileText,
    to: localePath('/admin/agenda-template'),
    title: t('admin.agenda.title'),
    desc: t('executive.tools.agenda'),
    show: isAdmin.value,
  },
  {
    key: 'settings',
    icon: Settings,
    to: localePath('/admin/settings'),
    title: t('admin.settings'),
    desc: t('executive.tools.settings'),
    show: isAdmin.value,
  },
  {
    key: 'uploads',
    icon: ImageUp,
    to: localePath('/admin/uploads'),
    title: t('admin.uploads.title'),
    desc: t('executive.tools.uploads'),
    show: isAdmin.value,
  },
].filter(tool => tool.show))

useHead(() => ({ title: t('executive.title') }))
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12">
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('executive.title') }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{ t('executive.subtitle') }}
      </p>
    </header>

    <div class="grid gap-4 sm:grid-cols-2">
      <NuxtLink
        v-for="tool in tools"
        :key="tool.key"
        :to="tool.to"
        class="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card class="h-full transition-colors hover:border-primary hover:bg-muted/40">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-base">
              <component
                :is="tool.icon"
                class="size-4 text-primary"
              />
              {{ tool.title }}
            </CardTitle>
            <CardDescription>{{ tool.desc }}</CardDescription>
          </CardHeader>
        </Card>
      </NuxtLink>
    </div>
  </div>
</template>
