import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Department,
  Priority,
  WhatsappConnectionInfo,
  WhatsappGroup,
  WhatsappMessage,
  WhatsappMessageActionStatus,
} from '~/types/models'
import { assertSupabaseConfig } from '~/utils/supabaseApi'

interface ManageResponse {
  ok?: boolean
  error?: string
  data?: Record<string, unknown>
}

function mapGroup(row: Record<string, unknown>, unreadCount = 0): WhatsappGroup {
  return {
    id: String(row.id ?? ''),
    groupJid: String(row.group_jid ?? ''),
    name: String(row.name ?? ''),
    isMonitored: Boolean(row.is_monitored),
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
    unreadCount,
  }
}

function mapMessage(row: Record<string, unknown>): WhatsappMessage {
  return {
    id: String(row.id ?? ''),
    externalId: String(row.external_id ?? ''),
    groupJid: String(row.group_jid ?? ''),
    groupName: String(row.group_name ?? ''),
    direction: (row.direction === 'out' ? 'out' : 'in'),
    senderName: String(row.sender_name ?? ''),
    senderPhone: String(row.sender_phone ?? ''),
    senderJid: String(row.sender_jid ?? ''),
    body: String(row.body ?? ''),
    receivedAt: String(row.received_at ?? ''),
    actionStatus: (row.action_status as WhatsappMessageActionStatus) || 'new',
    incidentId: row.incident_id ? String(row.incident_id) : null,
    handledBy: String(row.handled_by ?? ''),
    handledAt: row.handled_at ? String(row.handled_at) : null,
    replyText: String(row.reply_text ?? ''),
  }
}

class WhatsAppModule {
  private client: SupabaseClient
  private supabaseUrl: string
  private supabaseAnonKey: string

  constructor(client: SupabaseClient, supabaseUrl: string, supabaseAnonKey: string) {
    this.client = client
    this.supabaseUrl = supabaseUrl
    this.supabaseAnonKey = supabaseAnonKey
  }

  private assertConfigured(): void {
    assertSupabaseConfig(this.supabaseUrl, this.supabaseAnonKey)
  }

  private functionsUrl(): string {
    return `${this.supabaseUrl.replace(/\/$/, '')}/functions/v1/whatsapp-manage`
  }

  private async callManage(body: Record<string, unknown>): Promise<ManageResponse> {
    this.assertConfigured()
    const { data: sessionData } = await this.client.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Niet ingelogd')

    const res = await fetch(this.functionsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const json = await res.json().catch(() => ({})) as ManageResponse
    if (!res.ok || json.error) {
      throw new Error(json.error || `Request mislukt (${res.status})`)
    }
    return json
  }

  async getStatus(): Promise<WhatsappConnectionInfo> {
    const json = await this.callManage({ action: 'get_status' })
    const d = json.data ?? {}
    return {
      status: (d.status as WhatsappConnectionInfo['status']) || 'disconnected',
      phone: String(d.phone ?? ''),
      hasQr: Boolean(d.hasQr),
      qrUpdatedAt: d.qrUpdatedAt ? String(d.qrUpdatedAt) : null,
      lastConnectedAt: d.lastConnectedAt ? String(d.lastConnectedAt) : null,
      isAdmin: Boolean(d.isAdmin),
    }
  }

  async getQr(): Promise<WhatsappConnectionInfo> {
    const json = await this.callManage({ action: 'get_qr' })
    const d = json.data ?? {}
    return {
      status: (d.status as WhatsappConnectionInfo['status']) || 'qr',
      phone: String(d.phone ?? ''),
      hasQr: Boolean(d.qrBase64),
      qrBase64: d.qrBase64 ? String(d.qrBase64) : '',
      qrUpdatedAt: d.qrUpdatedAt ? String(d.qrUpdatedAt) : null,
    }
  }

  async disconnect(): Promise<void> {
    await this.callManage({ action: 'disconnect' })
  }

  async syncGroups(): Promise<number> {
    const json = await this.callManage({ action: 'sync_groups' })
    return Number(json.data?.count ?? 0)
  }

  async setMonitored(groupJid: string, isMonitored: boolean): Promise<void> {
    await this.callManage({ action: 'set_monitored', groupJid, isMonitored })
  }

  async monitorActiveToday(): Promise<number> {
    const json = await this.callManage({ action: 'monitor_active_today' })
    return Number(json.data?.count ?? 0)
  }

  async sendReply(messageId: string, text: string): Promise<void> {
    await this.callManage({ action: 'send_reply', messageId, text })
  }

  async markMessage(messageId: string, status: WhatsappMessageActionStatus): Promise<void> {
    await this.callManage({ action: 'mark_message', messageId, status })
  }

  async linkIncident(messageId: string, incidentId: string): Promise<void> {
    await this.callManage({ action: 'link_incident', messageId, incidentId })
  }

  async createIncidentFromMessage(payload: {
    messageId: string
    department: Department
    locationId: string
    incidentTypeId: string
    priority: Priority
    description: string
    reporter?: string
    sectorRow?: string
    sectorColumn?: number | null
    helpOptionIds?: string[]
  }): Promise<string> {
    const json = await this.callManage({ action: 'create_incident', ...payload })
    return String(json.data?.incidentId ?? '')
  }

  async listGroups(): Promise<WhatsappGroup[]> {
    this.assertConfigured()
    const { data, error } = await this.client
      .from('whatsapp_groups')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw new Error(error.message)

    const groups = (data ?? []) as Record<string, unknown>[]
    const unreadByGroup = await this.countUnreadByGroup()

    return groups.map(row => mapGroup(row, unreadByGroup[String(row.group_jid)] ?? 0))
  }

  private async countUnreadByGroup(): Promise<Record<string, number>> {
    const { data, error } = await this.client
      .from('whatsapp_messages_view')
      .select('group_jid, action_status')
      .eq('action_status', 'new')
      .eq('direction', 'in')

    if (error) {
      console.warn('[whatsapp] unread count', error.message)
      return {}
    }

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      const jid = String((row as { group_jid?: string }).group_jid ?? '')
      if (!jid) continue
      counts[jid] = (counts[jid] ?? 0) + 1
    }
    return counts
  }

  async listMessages(options: {
    groupJid?: string | null
    since?: string | null
    limit?: number
  } = {}): Promise<WhatsappMessage[]> {
    this.assertConfigured()
    let query = this.client
      .from('whatsapp_messages_view')
      .select('*')
      .order('received_at', { ascending: true })
      .limit(options.limit ?? 200)

    if (options.groupJid) {
      query = query.eq('group_jid', options.groupJid)
    }
    if (options.since) {
      query = query.gte('received_at', options.since)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return ((data ?? []) as Record<string, unknown>[]).map(mapMessage)
  }

  async getMessageById(id: string): Promise<WhatsappMessage | null> {
    this.assertConfigured()
    const { data, error } = await this.client
      .from('whatsapp_messages_view')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? mapMessage(data as Record<string, unknown>) : null
  }
}

export default WhatsAppModule
