import type { IncidentConfig } from '~/types/models'
import type IncidentsModule from '~/repository/modules/incidents'

declare module '#app' {
  interface NuxtApp {
    $api: {
      incidents: IncidentsModule
    }
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $api: {
      incidents: IncidentsModule
    }
  }
}

export {}

declare global {
  interface Window {
    __INCIDENT_CONFIG__?: IncidentConfig
  }
}
