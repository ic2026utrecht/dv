import type {
  IncidentConfig,
  IncidentSubmission,
  IncidentSubmissionResult,
  Incident,
  IncidentUpdateResult,
  IncidentStatusUpdate,
  IncidentUpdateEntry,
} from '~/types/models'

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

export interface IncidentStatusHistoryResponse {
  data: IncidentStatusUpdate[]
}

export interface IncidentUpdateHistoryResponse {
  data: IncidentUpdateEntry[]
}
