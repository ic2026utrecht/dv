import { createClient } from '@supabase/supabase-js'
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

  const client = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
  )

  const modules = {
    incidents: new IncidentsModule(client, supabaseUrl, supabaseAnonKey),
  }

  return {
    provide: {
      api: modules,
    },
  }
})
