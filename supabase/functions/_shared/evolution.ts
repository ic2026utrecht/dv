import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  corsHeaders,
  errorResponse,
  jsonResponse,
} from './staffAuth.ts'

export { corsHeaders, errorResponse, jsonResponse }

export interface EvolutionConfig {
  apiUrl: string
  apiKey: string
  instanceName: string
  webhookSecret: string
}

export function getEvolutionConfig(): EvolutionConfig {
  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') ?? '').replace(/\/$/, '')
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') ?? ''
  const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') ?? 'ic2026-controlroom'
  const webhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') ?? ''

  if (!apiUrl || !apiKey) {
    throw new Error('EVOLUTION_API_URL of EVOLUTION_API_KEY ontbreekt')
  }

  return { apiUrl, apiKey, instanceName, webhookSecret }
}

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function evolutionFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const cfg = getEvolutionConfig()
  const url = `${cfg.apiUrl}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(options.headers)
  headers.set('apikey', cfg.apiKey)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  return await fetch(url, { ...options, headers })
}

export function mapConnectionState(raw: unknown): 'disconnected' | 'qr' | 'connecting' | 'connected' {
  const value = String(raw ?? '').toLowerCase()
  if (value.includes('open') || value === 'connected') return 'connected'
  if (value.includes('qr') || value === 'qrcode') return 'qr'
  if (value.includes('connecting') || value.includes('pairing')) return 'connecting'
  return 'disconnected'
}

/** Extract text body from Evolution message payload shapes */
export function extractMessageBody(message: Record<string, unknown> | null | undefined): string {
  if (!message) return ''
  const conversation = message.conversation
  if (typeof conversation === 'string') return conversation

  const extended = message.extendedTextMessage as { text?: string } | undefined
  if (extended?.text) return extended.text

  const image = message.imageMessage as { caption?: string } | undefined
  if (image?.caption) return image.caption

  const video = message.videoMessage as { caption?: string } | undefined
  if (video?.caption) return video.caption

  const doc = message.documentMessage as { caption?: string; fileName?: string } | undefined
  if (doc?.caption) return doc.caption
  if (doc?.fileName) return `[Document] ${doc.fileName}`

  if (message.imageMessage) return '[Afbeelding]'
  if (message.videoMessage) return '[Video]'
  if (message.audioMessage) return '[Audio]'
  if (message.stickerMessage) return '[Sticker]'
  if (message.locationMessage) return '[Locatie]'
  if (message.contactMessage) return '[Contact]'

  return ''
}

export function jidToPhone(jid: string): string {
  const local = jid.split('@')[0] ?? ''
  const digits = local.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('+') ? digits : `+${digits}`
}
