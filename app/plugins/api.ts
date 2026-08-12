import IncidentsModule from '~/repository/modules/incidents'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const supabaseUrl = (config.public.supabaseUrl as string || '').trim()
  const supabaseAnonKey = (config.public.supabaseAnonKey as string || '').trim()

  if (import.meta.dev && (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey.includes('YOUR_'))) {
    console.warn(
      '[IC2026] Set NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY in .env, then restart pnpm dev.',
    )
  }

  // Reuse the authenticated client from @nuxtjs/supabase so JWTs are applied to RLS
  const client = useSupabaseClient()

  const modules = {
    incidents: new IncidentsModule(client, supabaseUrl, supabaseAnonKey),
  }

  return {
    provide: {
      api: modules,
    },
  }
})
