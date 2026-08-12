import type {
  WhatsappConnectionInfo,
  WhatsappFeedPeriodFilter,
  WhatsappFeedStatusFilter,
  WhatsappGroup,
  WhatsappMessage,
  WhatsappMessageActionStatus,
} from '~/types/models'

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

export function useWhatsappFeed() {
  const { $api } = useNuxtApp()
  const supabase = useSupabaseClient()

  const connection = useState<WhatsappConnectionInfo | null>('wa-connection', () => null)
  const groups = useState<WhatsappGroup[]>('wa-groups', () => [])
  const messages = useState<WhatsappMessage[]>('wa-messages', () => [])
  const loading = useState('wa-loading', () => false)
  const refreshing = useState('wa-refreshing', () => false)
  const error = useState<string | null>('wa-error', () => null)

  const selectedGroupJid = useState<string | null>('wa-selected-group', () => null)
  const selectedMessageId = useState<string | null>('wa-selected-message', () => null)
  const statusFilter = useState<WhatsappFeedStatusFilter>('wa-status-filter', () => 'actionable')
  const periodFilter = useState<WhatsappFeedPeriodFilter>('wa-period-filter', () => 'today')
  const activeOnlyGroups = useState('wa-active-only-groups', () => false)

  let channel: ReturnType<typeof supabase.channel> | null = null

  const unreadTotal = computed(() =>
    groups.value.reduce((sum, g) => sum + (g.isMonitored ? g.unreadCount : 0), 0),
  )

  const monitoredGroups = computed(() => groups.value.filter(g => g.isMonitored))

  const filteredGroups = computed(() => {
    let list = [...groups.value]
    if (activeOnlyGroups.value) {
      const start = startOfTodayIso()
      list = list.filter(g => g.lastMessageAt && g.lastMessageAt >= start)
    }
    return list.sort((a, b) => {
      if (a.isMonitored !== b.isMonitored) return a.isMonitored ? -1 : 1
      return a.name.localeCompare(b.name, 'nl')
    })
  })

  const filteredMessages = computed(() => {
    let list = [...messages.value]

    if (selectedGroupJid.value) {
      list = list.filter(m => m.groupJid === selectedGroupJid.value)
    }

    switch (statusFilter.value) {
      case 'actionable':
        list = list.filter(m => m.direction === 'in' && (m.actionStatus === 'new' || m.actionStatus === 'flagged'))
        break
      case 'new':
        list = list.filter(m => m.actionStatus === 'new')
        break
      case 'handled':
        list = list.filter(m => m.actionStatus === 'handled' || m.actionStatus === 'dismissed')
        break
      case 'flagged':
        list = list.filter(m => m.actionStatus === 'flagged')
        break
      default:
        break
    }

    return list
  })

  const selectedMessage = computed(() =>
    messages.value.find(m => m.id === selectedMessageId.value) ?? null,
  )

  function periodSince(): string | null {
    if (periodFilter.value === 'today') return startOfTodayIso()
    if (periodFilter.value === '24h') return hoursAgoIso(24)
    return null
  }

  async function fetchConnection() {
    connection.value = await $api.whatsapp.getStatus()
  }

  async function fetchGroups() {
    groups.value = await $api.whatsapp.listGroups()
  }

  async function fetchMessages() {
    messages.value = await $api.whatsapp.listMessages({
      groupJid: selectedGroupJid.value,
      since: periodSince(),
      limit: 300,
    })
  }

  async function loadAll(opts: { background?: boolean } = {}) {
    if (opts.background) {
      refreshing.value = true
    }
    else {
      loading.value = true
    }
    error.value = null
    try {
      await Promise.all([fetchConnection(), fetchGroups(), fetchMessages()])
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Laden mislukt'
      throw err
    }
    finally {
      loading.value = false
      refreshing.value = false
    }
  }

  async function refreshMessages() {
    try {
      await fetchMessages()
      await fetchGroups()
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Vernieuwen mislukt'
    }
  }

  function upsertMessageLocal(msg: WhatsappMessage) {
    const idx = messages.value.findIndex(m => m.id === msg.id)
    if (idx >= 0) {
      const next = [...messages.value]
      next[idx] = msg
      messages.value = next
    }
    else {
      messages.value = [...messages.value, msg].sort(
        (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
      )
    }
  }

  function patchMessageLocal(id: string, patch: Partial<WhatsappMessage>) {
    const idx = messages.value.findIndex(m => m.id === id)
    if (idx < 0) return
    const next = [...messages.value]
    next[idx] = { ...next[idx], ...patch }
    messages.value = next
  }

  async function markMessage(id: string, status: WhatsappMessageActionStatus) {
    const prev = messages.value.find(m => m.id === id)
    patchMessageLocal(id, { actionStatus: status, handledAt: new Date().toISOString() })
    try {
      await $api.whatsapp.markMessage(id, status)
      await fetchGroups()
    }
    catch (err) {
      if (prev) patchMessageLocal(id, prev)
      throw err
    }
  }

  async function sendReply(id: string, text: string) {
    await $api.whatsapp.sendReply(id, text)
    await refreshMessages()
  }

  async function linkIncident(id: string, incidentId: string) {
    await $api.whatsapp.linkIncident(id, incidentId)
    patchMessageLocal(id, { incidentId })
  }

  async function setMonitored(groupJid: string, isMonitored: boolean) {
    const idx = groups.value.findIndex(g => g.groupJid === groupJid)
    if (idx >= 0) {
      const next = [...groups.value]
      next[idx] = { ...next[idx], isMonitored }
      groups.value = next
    }
    try {
      await $api.whatsapp.setMonitored(groupJid, isMonitored)
      await refreshMessages()
    }
    catch (err) {
      await fetchGroups()
      throw err
    }
  }

  function startRealtime() {
    if (!import.meta.client || channel) return

    channel = supabase
      .channel('whatsapp-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        () => {
          refreshMessages().catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_message_actions' },
        () => {
          refreshMessages().catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_groups' },
        () => {
          fetchGroups().catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_instances' },
        () => {
          fetchConnection().catch(() => {})
        },
      )
      .subscribe()
  }

  function stopRealtime() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  watch([selectedGroupJid, periodFilter], () => {
    fetchMessages().catch(() => {})
  })

  return {
    connection,
    groups,
    messages,
    loading,
    refreshing,
    error,
    selectedGroupJid,
    selectedMessageId,
    selectedMessage,
    statusFilter,
    periodFilter,
    activeOnlyGroups,
    unreadTotal,
    monitoredGroups,
    filteredGroups,
    filteredMessages,
    loadAll,
    refreshMessages,
    fetchConnection,
    fetchGroups,
    markMessage,
    sendReply,
    linkIncident,
    setMonitored,
    upsertMessageLocal,
    patchMessageLocal,
    startRealtime,
    stopRealtime,
  }
}
