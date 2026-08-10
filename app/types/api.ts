import type { IncidentConfig, IncidentSubmission, IncidentSubmissionResult } from '~/types/models'

export type { IncidentSubmission }

export interface ConfigResponse {
  data: IncidentConfig
}

export interface SubmitIncidentResponse {
  data: IncidentSubmissionResult
}
