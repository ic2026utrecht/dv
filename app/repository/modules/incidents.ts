import HttpFactory from '~/repository/factory'
import type { SubmitIncidentResponse, ConfigResponse } from '~/types/api'
import type { IncidentSubmission } from '~/types/models'

class IncidentsModule extends HttpFactory {
  async getConfig(): Promise<ConfigResponse> {
    return await this.call<ConfigResponse>('GET', '?action=config')
  }

  async submit(payload: IncidentSubmission): Promise<SubmitIncidentResponse> {
    // text/plain avoids CORS preflight with Google Apps Script Web App
    return await this.call<SubmitIncidentResponse>('POST', '', payload, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    })
  }
}

export default IncidentsModule
