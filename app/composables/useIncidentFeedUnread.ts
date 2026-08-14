export function useIncidentFeedUnread() {
  const { $api } = useNuxtApp()

  const unreadByIncident = useState<Record<string, number>>('incident-feed-unread', () => ({}))

  function unreadCount(incidentId: string): number {
    return unreadByIncident.value[incidentId] ?? 0
  }

  async function loadUnreadCounts() {
    unreadByIncident.value = await $api.incidents.getFeedUnreadCounts()
  }

  async function markRead(incidentId: string, readAt?: string) {
    const trimmedId = incidentId.trim()
    if (!trimmedId) {
      return
    }

    const next = { ...unreadByIncident.value }
    delete next[trimmedId]
    unreadByIncident.value = next

    try {
      await $api.incidents.markFeedRead(trimmedId, readAt)
    }
    catch (err) {
      await loadUnreadCounts().catch(() => {})
      throw err
    }
  }

  return {
    unreadByIncident,
    unreadCount,
    loadUnreadCounts,
    markRead,
  }
}
