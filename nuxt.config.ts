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
    // S3-compatible object storage for uploaded images (issue #10, PRD §2/§15).
    // Server-only secrets — injected by Coolify, never committed. Backend-agnostic
    // (MinIO on Coolify, Cloudflare R2, Backblaze B2, AWS S3): only these vars
    // change. Empty endpoint ⇒ uploads disabled (route returns 503). When
    // `publicBaseUrl` is set the bucket is served directly; otherwise images are
    // proxied through Nitro at /api/uploads/<key>.
    s3: {
      endpoint: process.env.S3_ENDPOINT || '',
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET || '',
      accessKey: process.env.S3_ACCESS_KEY || '',
      secretKey: process.env.S3_SECRET_KEY || '',
      // MinIO and most self-hosted servers need path-style addressing.
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      // Optional public base URL of the bucket; omit to proxy via Nitro.
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '',
      // Max upload size in bytes (default 5 MB).
      maxBytes: Number(process.env.S3_MAX_BYTES) || 5 * 1024 * 1024,
    },
    // Cloudflare Turnstile CAPTCHA (issue #26) — bot protection on the
    // unauthenticated, email-sending endpoints (register, password reset).
    // Server-only secret; resolved from the admin `settings` table first, then
    // this env var (see server/utils/turnstile.ts). Empty ⇒ CAPTCHA is bypassed
    // (graceful dev/test degradation, like the email stub). The matching public
    // site key lives under `public.turnstileSiteKey` below — set both together.
    turnstile: {
      secretKey: process.env.TURNSTILE_SECRET_KEY || '',
    },
    public: {
      siteUrl: process.env.SITE_URL || '', // NUXT_PUBLIC_SITE_URL
      // Public Turnstile site key — safe to ship to the browser. Empty ⇒ the
      // widget is not rendered and the form submits without a CAPTCHA.
      turnstileSiteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY || '',
    },
  },
  compatibilityDate: '2025-01-01',

  // Scheduled email notifications (PRD §10). The dispatcher runs every 15 min
  // and fires any DB-defined schedule that's due (server/tasks/notifications/
  // dispatch.ts); the role-reminder task runs once a day and emails members
  // before a meeting where they hold a role (issue #59, role-reminders.ts).
  // Experimental tasks must be enabled for scheduledTasks.
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '*/15 * * * *': ['notifications:dispatch'],
      '0 9 * * *': ['notifications:role-reminders'],
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
