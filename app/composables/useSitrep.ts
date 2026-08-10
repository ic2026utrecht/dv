import type { Department, Incident, SitrepSummary, IncidentUpdate } from '~/types/models'

const POLL_INTERVAL_MS = 60_000

let pollTimer: ReturnType<typeof setInterval> | null = null

function clearPollTimer() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function computeSummary(incidents: Incident[]): SitrepSummary {
  const byDepartment: Record<Department, number> = {
    Parkeer: 0,
    Dienstverlening: 0,
    EHBO: 0,
  }

  let open = 0
  let criticalOpen = 0
  let hoogOpen = 0

  for (const incident of incidents) {
    if (incident.isOpen) {
      open++
      if (incident.department in byDepartment) {
        byDepartment[incident.department as Department]++
      }
      if (incident.priority === 'Critical') {
        criticalOpen++
      }
      if (incident.priority === 'Hoog') {
        hoogOpen++
      }
    }
  }

  return {
    total: incidents.length,
    open,
    closed: incidents.length - open,
    criticalOpen,
    hoogOpen,
    byDepartment,
  }
}

function sortByTimestampDesc(a: Incident, b: Incident): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
}

export const useSitrep = () => {
  const { $api } = useNuxtApp()

  const incidents = useState<Incident[]>('sitrep-incidents', () => [])
  const loading = useState('sitrep-loading', () => false)
  const refreshing = useState('sitrep-refreshing', () => false)
  const error = useState<string | null>('sitrep-error', () => null)
  const lastUpdated = useState<Date | null>('sitrep-last-updated', () => null)

  const summary = computed(() => computeSummary(incidents.value))
  const openIncidents = computed(() =>
    incidents.value.filter(i => i.isOpen).sort(sortByTimestampDesc),
  )
  const timelineIncidents = computed(() =>
    [...incidents.value].sort(sortByTimestampDesc),
  )

  const fetchIncidents = async (silent = false) => {
    if (!silent) {
      loading.value = true
    }
    error.value = null

    try {
      const response = await $api.incidents.list()
      incidents.value = response.data ?? []
      lastUpdated.value = new Date()
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Kon incidenten niet laden'
      throw err
    }
    finally {
      if (!silent) {
        loading.value = false
      }
    }
  }

  const refreshIncidents = async () => {
    if (refreshing.value) {
      return
    }

    refreshing.value = true
    error.value = null

    try {
      const response = await $api.incidents.list()
      incidents.value = response.data ?? []
      lastUpdated.value = new Date()
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Kon incidenten niet laden'
      throw err
    }
    finally {
      refreshing.value = false
    }
  }

  const startPolling = () => {
    if (!import.meta.client) {
      return
    }

    clearPollTimer()
    pollTimer = setInterval(() => {
      fetchIncidents(true).catch(() => {})
    }, POLL_INTERVAL_MS)
  }

  const stopPolling = () => {
    clearPollTimer()
  }

  onUnmounted(() => {
    stopPolling()
  })

  const updateIncident = async (payload: IncidentUpdate) => {
    const response = await $api.incidents.update(payload)
    await fetchIncidents(true)
    return response.data
  }

  return {
    incidents,
    loading,
    refreshing,
    error,
    lastUpdated,
    summary,
    openIncidents,
    timelineIncidents,
    fetchIncidents,
    refreshIncidents,
    updateIncident,
    startPolling,
    stopPolling,
  }
}
