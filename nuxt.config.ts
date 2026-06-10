import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@nuxtjs/i18n',
    'nuxt-auth-utils',
    'shadcn-nuxt',
  ],
  devtools: { enabled: true },

  // Favicon files are generated from the club's Toastmasters logo and live in
  // public/ (gitignored alongside it — trademarked, supplied per deployment).
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  css: ['~/assets/css/tailwind.css'],

  // Club-agnostic & secret values come from env vars (Coolify) — never committed.
  // Anything under `public` is exposed to the client.
  runtimeConfig: {
    // Falls back to the plain DATABASE_URL so the same var works for the app,
    // drizzle-kit and the seed script. Override in prod with NUXT_DATABASE_URL.
    databaseUrl: process.env.DATABASE_URL || '',
    // nuxt-auth-utils: sealed-cookie session (NUXT_SESSION_PASSWORD, 32+ chars).
    session: {
      maxAge: 60 * 60 * 24 * 7, // 1 week
    },
    public: {
      siteUrl: process.env.SITE_URL || '', // NUXT_PUBLIC_SITE_URL
    },
  },
  compatibilityDate: '2025-01-01',

  // Scheduled email notifications (PRD §10). The dispatcher runs every 15 min
  // and fires any DB-defined schedule that's due (server/tasks/notifications/
  // dispatch.ts). Experimental tasks must be enabled for scheduledTasks.
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '*/15 * * * *': ['notifications:dispatch'],
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },

  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    langDir: 'locales',
    locales: [
      { code: 'en', language: 'en-CA', name: 'English', file: 'en.json' },
      { code: 'fr', language: 'fr-CA', name: 'Français', file: 'fr.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      redirectOn: 'root',
      alwaysRedirect: false,
    },
    bundle: {
      optimizeTranslationDirective: false,
    },
  },

  shadcn: {
    // Empty prefix: components imported as <Button/> etc.
    prefix: '',
    // Respects the Nuxt `@` alias → app/components/ui
    componentDir: '@/components/ui',
  },
})
