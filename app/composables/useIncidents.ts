import type { IncidentConfig, IncidentSubmission, IncidentSubmissionResult } from '~/types/models'

const CACHE_TTL_MS = 5 * 60 * 1000

export const useIncidents = () => {
  const { $api } = useNuxtApp()
  const store = useIncidentConfigStore()

  const fetchConfig = async (refresh = false): Promise<IncidentConfig> => {
    if (
      !refresh
      && store.config
      && store.loadedAt
      && Date.now() - store.loadedAt < CACHE_TTL_MS
    ) {
      return store.config
    }

    store.setLoading(true)
    store.setError(null)

    try {
      const response = await $api.incidents.getConfig()
      store.setConfig(response.data)
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
