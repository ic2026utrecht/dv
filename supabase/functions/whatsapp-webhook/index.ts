import {
  corsHeaders,
  errorResponse,
  extractMessageBody,
  getServiceClient,
  jidToPhone,
  jsonResponse,
  mapConnectionState,
} from '../_shared/evolution.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const webhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') ?? ''
    if (webhookSecret) {
      const headerKey = req.headers.get('apikey')
        || req.headers.get('x-webhook-secret')
        || ''
      if (headerKey !== webhookSecret) {
        return errorResponse('Ongeldige webhook secret', 401)
      }
    }

    const payload = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!payload) {
      return errorResponse('Ongeldige JSON body', 400)
    }

    const event = String(payload.event ?? payload.type ?? '').toLowerCase()
    const service = getServiceClient()

    if (event.includes('qrcode') || event === 'qrcode.updated') {
      await handleQrUpdated(service, payload)
      return jsonResponse({ ok: true })
    }

    if (event.includes('connection') || event === 'connection.update') {
      await handleConnectionUpdate(service, payload)
      return jsonResponse({ ok: true })
    }

    if (event.includes('messages.upsert') || event.includes('messages_upsert') || event === 'messages.upsert') {
      await handleMessagesUpsert(service, payload)
      return jsonResponse({ ok: true })
    }

    // Some Evolution versions nest event differently
    if (payload.data && typeof payload.data === 'object') {
      const data = payload.data as Record<string, unknown>
      if (data.qrcode || data.base64) {
        await handleQrUpdated(service, payload)
        return jsonResponse({ ok: true })
      }
    }

    return jsonResponse({ ok: true, ignored: event || 'unknown' })
  }
  catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook mislukt'
    console.error('[whatsapp-webhook]', message, err)
    return errorResponse(message, 500)
  }
})

async function upsertInstance(
  service: ReturnType<typeof getServiceClient>,
  patch: Record<string, unknown>,
) {
  const { error } = await service
    .from('whatsapp_instances')
    .upsert({ id: 'default', updated_at: new Date().toISOString(), ...patch }, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

async function handleQrUpdated(
  service: ReturnType<typeof getServiceClient>,
  payload: Record<string, unknown>,
) {
  const data = (payload.data ?? payload) as Record<string, unknown>
  const qrcode = (data.qrcode ?? data) as Record<string, unknown>
  const base64 = String(
    qrcode.base64
    ?? data.base64
    ?? qrcode.qrcode
    ?? '',
  ).replace(/^data:image\/png;base64,/, '')

  await upsertInstance(service, {
    status: 'qr',
    qr_base64: base64,
    qr_updated_at: new Date().toISOString(),
  })
}

async function handleConnectionUpdate(
  service: ReturnType<typeof getServiceClient>,
  payload: Record<string, unknown>,
) {
  const data = (payload.data ?? payload) as Record<string, unknown>
  const state = mapConnectionState(data.state ?? data.status ?? data.connection)
  const phone = String(
    data.wuid
    ?? data.ownerJid
    ?? data.phone
    ?? '',
  )
  const phoneNormalized = phone.includes('@') ? jidToPhone(phone) : (phone ? (phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`) : '')

  const patch: Record<string, unknown> = {
    status: state,
  }
  if (phoneNormalized) patch.phone = phoneNormalized
  if (state === 'connected') {
    patch.last_connected_at = new Date().toISOString()
    patch.qr_base64 = ''
  }
  if (state === 'disconnected') {
    patch.qr_base64 = ''
  }

  await upsertInstance(service, patch)
}

async function handleMessagesUpsert(
  service: ReturnType<typeof getServiceClient>,
  payload: Record<string, unknown>,
) {
  const data = payload.data ?? payload
  const items = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.messages)
      ? (data as { messages: unknown[] }).messages
      : [data]

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const key = (item.key ?? {}) as Record<string, unknown>
    const remoteJid = String(key.remoteJid ?? item.remoteJid ?? '')
    if (!remoteJid) continue

    // Only persist group messages for the shared inbox
    const isGroup = remoteJid.endsWith('@g.us') || Boolean(item.isGroup)
    if (!isGroup) continue

    const externalId = String(
      key.id
      ?? item.id
      ?? `${remoteJid}-${item.messageTimestamp ?? Date.now()}`,
    )
    if (!externalId) continue

    const fromMe = Boolean(key.fromMe ?? item.fromMe)
    const direction = fromMe ? 'out' : 'in'

    // Skip non-monitored groups for inbound (still allow outbound logging)
    if (direction === 'in') {
      const { data: group } = await service
        .from('whatsapp_groups')
        .select('is_monitored')
        .eq('group_jid', remoteJid)
        .maybeSingle()

      // Auto-discover group if missing (not monitored yet → skip message)
      if (!group) {
        const pushName = String(item.pushName ?? '')
        await service.from('whatsapp_groups').upsert({
          group_jid: remoteJid,
          name: pushName || remoteJid,
          is_monitored: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'group_jid' })
        continue
      }
      if (!group.is_monitored) continue
    }

    const message = (item.message ?? {}) as Record<string, unknown>
    const body = extractMessageBody(message)
    if (!body.trim() && direction === 'in') {
      // Still store placeholder for media-only messages
    }

    const participant = String(
      key.participant
      ?? item.participant
      ?? item.sender
      ?? '',
    )
    const senderPhone = participant ? jidToPhone(participant) : ''
    const senderName = String(item.pushName ?? item.senderName ?? senderPhone ?? '')

    const tsRaw = item.messageTimestamp ?? item.timestamp
    let receivedAt = new Date().toISOString()
    if (typeof tsRaw === 'number') {
      receivedAt = new Date(tsRaw > 1e12 ? tsRaw : tsRaw * 1000).toISOString()
    }
    else if (typeof tsRaw === 'string' && tsRaw) {
      const n = Number(tsRaw)
      if (!Number.isNaN(n)) {
        receivedAt = new Date(n > 1e12 ? n : n * 1000).toISOString()
      }
      else {
        const d = new Date(tsRaw)
        if (!Number.isNaN(d.getTime())) receivedAt = d.toISOString()
      }
    }

    const { error } = await service.from('whatsapp_messages').upsert({
      external_id: externalId,
      group_jid: remoteJid,
      direction,
      sender_name: senderName,
      sender_phone: senderPhone,
      sender_jid: participant,
      body: body || (direction === 'in' ? '[Media]' : ''),
      received_at: receivedAt,
    }, { onConflict: 'external_id', ignoreDuplicates: true })

    if (error) {
      console.error('[whatsapp-webhook] insert message', error.message)
    }
  }
}
