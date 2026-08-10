import type { IncidentConfig, IncidentSubmission, IncidentSubmissionResult } from '~/types/models'
import {
  INCIDENT_CONFIG_CACHE_TTL_MS,
  readIncidentConfigCache,
  writeIncidentConfigCache,
} from '~/utils/incidentConfigCache'

function isStoreConfigFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < INCIDENT_CONFIG_CACHE_TTL_MS
}

export const useIncidents = () => {
  const { $api } = useNuxtApp()
  const store = useIncidentConfigStore()

  const fetchConfig = async (refresh = false): Promise<IncidentConfig> => {
    if (
      !refresh
      && store.config
      && isStoreConfigFresh(store.loadedAt)
    ) {
      return store.config
    }

    if (!refresh) {
      const cached = readIncidentConfigCache()
      if (cached) {
        store.setConfig(cached)
        return cached
      }
    }

    store.setLoading(true)
    store.setError(null)

    try {
      const response = await $api.incidents.getConfig()
      store.setConfig(response.data)
      writeIncidentConfigCache(response.data)
      return response.data
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kon configuratie niet laden'
      store.setError(message)
      throw error
    }
    finally {
      store.setLoading(false)
    }
  }

  const submitIncident = async (
    payload: IncidentSubmission,
  ): Promise<IncidentSubmissionResult> => {
    const response = await $api.incidents.submit(payload)
    return response.data
  }

  return {
    fetchConfig,
    submitIncident,
    config: computed(() => store.config),
    loading: computed(() => store.loading),
    error: computed(() => store.error),
    isLoaded: computed(() => store.isLoaded),
  }
}
