import IC2026Preset from './app/theme/ic2026-preset'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'ic'
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true'
const baseURL = isGitHubPages ? `/${repoName}/` : '/'

export default defineNuxtConfig({
  ssr: false,
  app: {
    baseURL,
    head: {
      title: 'IC2026 DV — Incidenten',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Incident registratie IC2026 DV' },
      ],
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40;700&display=swap',
        },
      ],
    },
  },
  srcDir: 'app/',
  components: [{ path: '~/components', pathPrefix: false }],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['primeicons/primeicons.css', '~/assets/css/main.css'],
  modules: ['@nuxtjs/tailwindcss', '@primevue/nuxt-module', '@pinia/nuxt'],
  runtimeConfig: {
    public: {
      sheetsApiUrl: process.env.NUXT_PUBLIC_SHEETS_API_URL ?? '',
    },
  },
  primevue: {
    options: {
      theme: {
        preset: IC2026Preset,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: {
            name: 'primevue',
            order: 'tailwind-base, primevue, tailwind-utilities',
          },
        },
      },
    },
  },
  nitro: {
    prerender: {
      routes: ['/kaart'],
    },
  },
  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
  },
})
