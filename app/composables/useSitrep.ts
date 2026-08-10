import { storeToRefs } from 'pinia'

export const useSitrep = () => {
  const store = useSitrepIncidentsStore()

  const {
    incidents,
    fetching,
    loading,
    refreshing,
    error,
    lastUpdated,
    lastUpdatedAt,
    summary,
    openIncidents,
    timelineIncidents,
    hasLoaded,
  } = storeToRefs(store)

  return {
    incidents,
    fetching,
    loading,
    refreshing,
    error,
    lastUpdated: lastUpdatedAt,
    hasLoaded,
    summary,
    openIncidents,
    timelineIncidents,
    fetchIncidents: (background = true) => store.fetchIncidents(background),
    refreshIncidents: () => store.refreshIncidents(),
    updateIncident: (payload: Parameters<typeof store.updateIncident>[0]) =>
      store.updateIncident(payload),
    startPolling: () => store.startPolling(),
    stopPolling: () => store.stopPolling(),
  }
}
