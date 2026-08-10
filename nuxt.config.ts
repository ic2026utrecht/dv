import Aura from '@primeuix/themes/aura'

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
        preset: Aura,
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
  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
  },
})
