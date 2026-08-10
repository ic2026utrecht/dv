import type { ConfigResponse, SubmitIncidentResponse, IncidentsResponse, UpdateIncidentResponse } from '~/types/api'
import type { IncidentSubmission, IncidentUpdate } from '~/types/models'
import { fetchSheetsConfig, postSheetsIncident, fetchSheetsIncidents, postSheetsIncidentUpdate } from '~/utils/sheetsApi'

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

  async list(): Promise<IncidentsResponse> {
    return await fetchSheetsIncidents(this.baseURL)
  }

  async update(payload: IncidentUpdate): Promise<UpdateIncidentResponse> {
    return await postSheetsIncidentUpdate(this.baseURL, payload)
  }
}

export default IncidentsModule
