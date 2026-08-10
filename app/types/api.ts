import type { IncidentConfig, IncidentSubmission, IncidentSubmissionResult, Incident, IncidentUpdateResult } from '~/types/models'

export type { IncidentSubmission }

export interface ConfigResponse {
  data: IncidentConfig
}

export interface SubmitIncidentResponse {
  data: IncidentSubmissionResult
}

export interface IncidentsResponse {
  data: Incident[]
}

export interface UpdateIncidentResponse {
  data: IncidentUpdateResult
}
