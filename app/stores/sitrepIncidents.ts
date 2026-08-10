import type { Department, Incident, IncidentUpdate, SitrepSummary } from '~/types/models'

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

export const useSitrepIncidentsStore = defineStore('sitrepIncidents', {
  state: () => ({
    incidents: [] as Incident[],
    fetching: false,
    manualRefresh: false,
    error: null as string | null,
    lastUpdated: null as number | null,
  }),

  getters: {
    hasLoaded: state => state.lastUpdated !== null,
    loading: state => state.fetching && state.lastUpdated === null,
    refreshing: state => state.fetching && state.manualRefresh,
    lastUpdatedAt: (state): Date | null =>
      state.lastUpdated ? new Date(state.lastUpdated) : null,
    summary: (state): SitrepSummary => computeSummary(state.incidents),
    openIncidents: (state): Incident[] =>
      state.incidents.filter(i => i.isOpen).sort(sortByTimestampDesc),
    timelineIncidents: (state): Incident[] =>
      [...state.incidents].sort(sortByTimestampDesc),
  },

  actions: {
    async loadIncidents(options: { manual?: boolean, background?: boolean } = {}) {
      if (this.fetching) {
        return
      }

      const manual = options.manual ?? false
      this.fetching = true
      this.manualRefresh = manual

      if (!options.background) {
        this.error = null
      }

      try {
        const { $api } = useNuxtApp()
        const response = await $api.incidents.list()
        this.incidents = response.data ?? []
        this.lastUpdated = Date.now()
        this.error = null
      }
      catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Kon incidenten niet laden'
        throw err
      }
      finally {
        this.fetching = false
        this.manualRefresh = false
      }
    },

    fetchIncidents(background = true) {
      return this.loadIncidents({ background })
    },

    refreshIncidents() {
      return this.loadIncidents({ manual: true, background: true })
    },

    async updateIncident(payload: IncidentUpdate) {
      const { $api } = useNuxtApp()
      const response = await $api.incidents.update(payload)
      await this.loadIncidents({ background: true })
      return response.data
    },

    startPolling() {
      if (!import.meta.client) {
        return
      }

      clearPollTimer()
      pollTimer = setInterval(() => {
        this.loadIncidents({ background: true }).catch(() => {})
      }, POLL_INTERVAL_MS)
    },

    stopPolling() {
      clearPollTimer()
    },

    clear() {
      this.incidents = []
      this.fetching = false
      this.manualRefresh = false
      this.error = null
      this.lastUpdated = null
      this.stopPolling()
    },
  },
})
