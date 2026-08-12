import {
  corsHeaders,
  errorResponse,
  evolutionFetch,
  getEvolutionConfig,
  getServiceClient,
  jsonResponse,
  mapConnectionState,
} from '../_shared/evolution.ts'

function staffDisplayName(row: { first_name?: string, last_name?: string }): string {
  return `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
}

interface StaffRow {
  id: string
  first_name: string
  last_name: string
  phone: string
  auth_user_id: string | null
  is_admin: boolean
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: errorResponse('Niet ingelogd', 401) }
  }
  const token = authHeader.slice(7)
  const service = getServiceClient()
  const { data, error } = await service.auth.getUser(token)
  if (error || !data.user) {
    return { error: errorResponse('Sessie ongeldig', 401) }
  }
  return { user: data.user, token, service }
}

async function requireStaff(req: Request) {
  const auth = await requireUser(req)
  if ('error' in auth && auth.error) return auth

  const { data: staff, error } = await auth.service!
    .from('staff')
    .select('*')
    .eq('auth_user_id', auth.user!.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff) return { error: errorResponse('Geen staff-profiel gevonden', 404) }

  return { ...auth, staff: staff as StaffRow }
}

async function requireAdmin(req: Request) {
  const auth = await requireStaff(req)
  if ('error' in auth && auth.error) return auth
  if (!auth.staff!.is_admin) {
    return { error: errorResponse('Alleen admins mogen dit doen', 403) }
  }
  return auth
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = String(body.action ?? '')

    switch (action) {
      case 'get_status':
        return await getStatus(req)
      case 'get_qr':
        return await getQr(req)
      case 'disconnect':
        return await disconnect(req)
      case 'sync_groups':
        return await syncGroups(req)
      case 'set_monitored':
        return await setMonitored(req, body)
      case 'monitor_active_today':
        return await monitorActiveToday(req)
      case 'send_reply':
        return await sendReply(req, body)
      case 'mark_message':
        return await markMessage(req, body)
      case 'link_incident':
        return await linkIncident(req, body)
      case 'create_incident':
        return await createIncident(req, body)
      default:
        return errorResponse(`Onbekende action: ${action || '(leeg)'}`, 400)
    }
  }
  catch (err) {
    const message = err instanceof Error ? err.message : 'Request mislukt'
    console.error('[whatsapp-manage]', message, err)
    return errorResponse(message, 500)
  }
})

async function getStatus(req: Request) {
  const auth = await requireStaff(req)
  if ('error' in auth && auth.error) return auth.error

  const { data, error } = await auth.service!
    .from('whatsapp_instances')
    .select('*')
    .eq('id', 'default')
    .maybeSingle()

  if (error) throw new Error(error.message)

  const instance = data ?? {
    id: 'default',
    status: 'disconnected',
    phone: '',
    qr_base64: '',
    qr_updated_at: null,
    last_connected_at: null,
  }

  return jsonResponse({
    ok: true,
    data: {
      status: instance.status,
      phone: instance.phone,
      hasQr: Boolean(instance.qr_base64),
      qrUpdatedAt: instance.qr_updated_at,
      lastConnectedAt: instance.last_connected_at,
      isAdmin: auth.staff!.is_admin,
    },
  })
}

async function getQr(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth && auth.error) return auth.error

  const cfg = getEvolutionConfig()

  // Request connect / QR from Evolution
  let base64 = ''
  let status: 'qr' | 'connecting' | 'connected' | 'disconnected' = 'qr'

  try {
    const res = await evolutionFetch(`/instance/connect/${cfg.instanceName}`)
    const json = await res.json().catch(() => ({})) as Record<string, unknown>
    const nested = (json.base64 ?? json.qrcode ?? json) as Record<string, unknown> | string
    if (typeof nested === 'string') {
      base64 = nested.replace(/^data:image\/png;base64,/, '')
    }
    else if (nested && typeof nested === 'object') {
      base64 = String(nested.base64 ?? nested.code ?? '').replace(/^data:image\/png;base64,/, '')
    }

    // Also check instance state
    const stateRes = await evolutionFetch(`/instance/connectionState/${cfg.instanceName}`)
    const stateJson = await stateRes.json().catch(() => ({})) as Record<string, unknown>
    const instance = (stateJson.instance ?? stateJson) as Record<string, unknown>
    status = mapConnectionState(instance.state ?? stateJson.state)
  }
  catch (err) {
    console.error('[whatsapp-manage] get_qr evolution', err)
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (base64) {
    patch.qr_base64 = base64
    patch.qr_updated_at = new Date().toISOString()
    patch.status = status === 'connected' ? 'connected' : 'qr'
  }

  await auth.service!
    .from('whatsapp_instances')
    .upsert({ id: 'default', ...patch }, { onConflict: 'id' })

  const { data } = await auth.service!
    .from('whatsapp_instances')
    .select('*')
    .eq('id', 'default')
    .single()

  return jsonResponse({
    ok: true,
    data: {
      status: data?.status ?? status,
      phone: data?.phone ?? '',
      qrBase64: data?.qr_base64 ?? base64,
      qrUpdatedAt: data?.qr_updated_at,
    },
  })
}

async function disconnect(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth && auth.error) return auth.error

  const cfg = getEvolutionConfig()
  try {
    await evolutionFetch(`/instance/logout/${cfg.instanceName}`, { method: 'DELETE' })
  }
  catch (err) {
    console.error('[whatsapp-manage] disconnect', err)
  }

  await auth.service!
    .from('whatsapp_instances')
    .upsert({
      id: 'default',
      status: 'disconnected',
      phone: '',
      qr_base64: '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  return jsonResponse({ ok: true })
}

async function syncGroups(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth && auth.error) return auth.error

  const cfg = getEvolutionConfig()
  const res = await evolutionFetch(`/group/fetchAllGroups/${cfg.instanceName}?getParticipants=false`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Groepen ophalen mislukt (${res.status}): ${text.slice(0, 200)}`)
  }

  const json = await res.json().catch(() => []) as unknown
  const list = Array.isArray(json)
    ? json
    : Array.isArray((json as { groups?: unknown[] })?.groups)
      ? (json as { groups: unknown[] }).groups
      : Array.isArray((json as { data?: unknown[] })?.data)
        ? (json as { data: unknown[] }).data
        : []

  let upserted = 0
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const g = raw as Record<string, unknown>
    const jid = String(g.id ?? g.jid ?? g.groupJid ?? '')
    if (!jid || !jid.endsWith('@g.us')) continue
    const name = String(g.subject ?? g.name ?? g.pushName ?? jid)

    const { error } = await auth.service!.from('whatsapp_groups').upsert({
      group_jid: jid,
      name,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'group_jid' })

    if (!error) upserted += 1
  }

  return jsonResponse({ ok: true, data: { count: upserted } })
}

async function setMonitored(req: Request, body: Record<string, unknown>) {
  const auth = await requireAdmin(req)
  if ('error' in auth && auth.error) return auth.error

  const groupJid = String(body.groupJid ?? '')
  const isMonitored = Boolean(body.isMonitored)
  if (!groupJid) return errorResponse('groupJid verplicht', 400)

  const { error } = await auth.service!
    .from('whatsapp_groups')
    .update({ is_monitored: isMonitored, updated_at: new Date().toISOString() })
    .eq('group_jid', groupJid)

  if (error) throw new Error(error.message)
  return jsonResponse({ ok: true })
}

async function monitorActiveToday(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth && auth.error) return auth.error

  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const { data: msgs, error } = await auth.service!
    .from('whatsapp_messages')
    .select('group_jid')
    .gte('received_at', start.toISOString())

  if (error) throw new Error(error.message)

  const jids = [...new Set((msgs ?? []).map(m => m.group_jid).filter(Boolean))]
  if (jids.length === 0) {
    return jsonResponse({ ok: true, data: { count: 0 } })
  }

  const { error: updErr } = await auth.service!
    .from('whatsapp_groups')
    .update({ is_monitored: true, updated_at: new Date().toISOString() })
    .in('group_jid', jids)

  if (updErr) throw new Error(updErr.message)
  return jsonResponse({ ok: true, data: { count: jids.length } })
}

async function sendReply(req: Request, body: Record<string, unknown>) {
  const auth = await requireStaff(req)
  if ('error' in auth && auth.error) return auth.error

  const messageId = String(body.messageId ?? '')
  const text = String(body.text ?? '').trim()
  if (!messageId) return errorResponse('messageId verplicht', 400)
  if (!text) return errorResponse('Bericht mag niet leeg zijn', 400)

  const { data: msg, error } = await auth.service!
    .from('whatsapp_messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!msg) return errorResponse('Bericht niet gevonden', 404)

  const cfg = getEvolutionConfig()
  const res = await evolutionFetch(`/message/sendText/${cfg.instanceName}`, {
    method: 'POST',
    body: JSON.stringify({
      number: msg.group_jid,
      text,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Versturen mislukt (${res.status}): ${errText.slice(0, 200)}`)
  }

  const json = await res.json().catch(() => ({})) as Record<string, unknown>
  const key = (json.key ?? {}) as Record<string, unknown>
  const externalId = String(key.id ?? `out-${Date.now()}`)

  await auth.service!.from('whatsapp_messages').upsert({
    external_id: externalId,
    group_jid: msg.group_jid,
    direction: 'out',
    sender_name: staffDisplayName(auth.staff!),
    sender_phone: auth.staff!.phone,
    sender_jid: '',
    body: text,
    received_at: new Date().toISOString(),
  }, { onConflict: 'external_id' })

  await auth.service!.from('whatsapp_message_actions').upsert({
    message_id: messageId,
    reply_text: text,
    handled_by: staffDisplayName(auth.staff!),
    handled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'message_id' })

  return jsonResponse({ ok: true })
}

async function markMessage(req: Request, body: Record<string, unknown>) {
  const auth = await requireStaff(req)
  if ('error' in auth && auth.error) return auth.error

  const messageId = String(body.messageId ?? '')
  const status = String(body.status ?? '')
  const allowed = ['new', 'handled', 'dismissed', 'flagged']
  if (!messageId) return errorResponse('messageId verplicht', 400)
  if (!allowed.includes(status)) return errorResponse('Ongeldige status', 400)

  const handledBy = staffDisplayName(auth.staff!)
  const { error } = await auth.service!.from('whatsapp_message_actions').upsert({
    message_id: messageId,
    status,
    handled_by: handledBy,
    handled_at: status === 'new' ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'message_id' })

  if (error) throw new Error(error.message)
  return jsonResponse({ ok: true, data: { handledBy } })
}

async function linkIncident(req: Request, body: Record<string, unknown>) {
  const auth = await requireStaff(req)
  if ('error' in auth && auth.error) return auth.error

  const messageId = String(body.messageId ?? '')
  const incidentId = String(body.incidentId ?? '').trim()
  if (!messageId) return errorResponse('messageId verplicht', 400)
  if (!incidentId) return errorResponse('incidentId verplicht', 400)

  const { data: incident, error: incErr } = await auth.service!
    .from('incidents')
    .select('incident_id')
    .eq('incident_id', incidentId)
    .maybeSingle()

  if (incErr) throw new Error(incErr.message)
  if (!incident) return errorResponse('Incident niet gevonden', 404)

  const { error } = await auth.service!.from('whatsapp_message_actions').upsert({
    message_id: messageId,
    incident_id: incidentId,
    handled_by: staffDisplayName(auth.staff!),
    handled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'message_id' })

  if (error) throw new Error(error.message)
  return jsonResponse({ ok: true })
}

async function createIncident(req: Request, body: Record<string, unknown>) {
  const auth = await requireStaff(req)
  if ('error' in auth && auth.error) return auth.error

  const messageId = String(body.messageId ?? '')
  if (!messageId) return errorResponse('messageId verplicht', 400)

  const { data: msg, error: msgErr } = await auth.service!
    .from('whatsapp_messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle()

  if (msgErr) throw new Error(msgErr.message)
  if (!msg) return errorResponse('Bericht niet gevonden', 404)

  const department = String(body.department ?? 'Dienstverlening')
  const locationId = String(body.locationId ?? '')
  const incidentTypeId = String(body.incidentTypeId ?? '')
  const priority = String(body.priority ?? 'Middel')
  const description = String(body.description ?? msg.body ?? '').trim()
  const reporter = String(
    body.reporter
    ?? [msg.sender_name, msg.sender_phone].filter(Boolean).join(' — '),
  ).trim()

  if (!locationId) return errorResponse('locationId verplicht', 400)
  if (!incidentTypeId) return errorResponse('incidentTypeId verplicht', 400)

  const { data: inserted, error: insErr } = await auth.service!
    .from('incidents')
    .insert({
      department,
      location_id: locationId,
      sector_row: String(body.sectorRow ?? ''),
      sector_column: body.sectorColumn ?? null,
      sector_label: '',
      incident_type_id: incidentTypeId,
      description,
      help_option_ids: Array.isArray(body.helpOptionIds)
        ? (body.helpOptionIds as string[]).join(',')
        : String(body.helpOptionIds ?? ''),
      priority,
      reporter,
      status: 'Open',
      source_row: 'whatsapp',
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
    })
    .select('incident_id')
    .single()

  if (insErr) throw new Error(insErr.message)

  const incidentId = inserted.incident_id as string

  await auth.service!.from('whatsapp_message_actions').upsert({
    message_id: messageId,
    status: 'handled',
    incident_id: incidentId,
    handled_by: staffDisplayName(auth.staff!),
    handled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'message_id' })

  return jsonResponse({ ok: true, data: { incidentId } })
}
