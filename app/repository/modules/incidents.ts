import type { SubmitIncidentResponse, ConfigResponse } from '~/types/api'
import type { IncidentSubmission } from '~/types/models'

class IncidentsModule {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  async getConfig(): Promise<ConfigResponse> {
    return await fetchSheetsConfig(this.baseURL)
  }

  async submit(payload: IncidentSubmission): Promise<SubmitIncidentResponse> {
    return await postSheetsIncident(this.baseURL, payload)
  }
}

export default IncidentsModule
