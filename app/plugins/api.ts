import IncidentsModule from '~/repository/modules/incidents'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const baseURL = (config.public.sheetsApiUrl as string || '').trim()

  if (import.meta.dev && (!baseURL || baseURL.includes('YOUR_DEPLOYMENT_ID'))) {
    console.warn(
      '[IC2026] Set NUXT_PUBLIC_SHEETS_API_URL in .env to your Apps Script /exec URL, then restart pnpm dev.',
    )
  }

  const modules = {
    incidents: new IncidentsModule(baseURL),
  }

  return {
    provide: {
      api: modules,
    },
  }
})
