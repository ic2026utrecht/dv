export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
}

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status)
}

/** Normalize NL-friendly phone input to E.164 (+316…) */
export function normalizePhone(input: unknown): string {
  const raw = String(input ?? '').trim()
  if (!raw) return ''
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`
  if (digits.startsWith('+')) {
    return `+${digits.slice(1).replace(/\D/g, '')}`
  }
  const only = digits.replace(/\D/g, '')
  if (only.startsWith('0') && only.length === 10) {
    return `+31${only.slice(1)}`
  }
  if (only.startsWith('31') && only.length >= 11) {
    return `+${only}`
  }
  if (only.length >= 9) {
    return `+${only}`
  }
  return only ? `+${only}` : ''
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9][0-9]{7,14}$/.test(phone)
}

/** Map phone to synthetic email for Supabase email+password auth */
export function phoneToEmail(phone: string): string {
  const normalized = normalizePhone(phone)
  const local = normalized.replace(/^\+/, '')
  return `${local}@staff.ic2026.local`
}

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin)
}
