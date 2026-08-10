import type { IncidentConfig } from '~/types/models'

export const useIncidentConfigStore = defineStore('incidentConfig', {
  state: () => ({
    config: null as IncidentConfig | null,
    loading: false,
    error: null as string | null,
    loadedAt: null as number | null,
  }),

  getters: {
    isLoaded: (state) => state.config !== null,
  },

  actions: {
    setConfig(config: IncidentConfig) {
      this.config = config
      this.loadedAt = Date.now()
    },
    setLoading(loading: boolean) {
      this.loading = loading
    },
    setError(error: string | null) {
      this.error = error
    },
    clear() {
      this.config = null
      this.loadedAt = null
      this.error = null
    },
  },
})
