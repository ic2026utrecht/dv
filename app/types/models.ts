export type Department = 'Parkeer' | 'Dienstverlening' | 'EHBO'

export type Priority = 'Critical' | 'Hoog' | 'Middel' | 'Laag'

export interface SelectOption {
  value: string
  label: string
}

export interface Location {
  id: string
  name: string
  zone: string
  active: boolean
}

export interface IncidentType {
  id: string
  department: Department
  name: string
}

export interface HelpOption {
  id: string
  name: string
  departments: Department[]
}

export interface RasterConfig {
  rows: string[]
  columns: number[]
}

export interface IncidentConfig {
  departments: SelectOption[]
  priorities: SelectOption[]
  locations: Location[]
  incidentTypes: IncidentType[]
  helpOptions: HelpOption[]
  raster: RasterConfig
  personsCountOptions: SelectOption[]
}

export interface IncidentSubmission {
  department: Department
  locationId: string
  sectorRow: string
  sectorColumn: number
  incidentTypeId: string
  priority: Priority
  helpOptionIds: string[]
  reporter: string
  description: string
  personsInvolved?: number
  ambulanceCalled?: boolean
}

export interface IncidentSubmissionResult {
  incidentId: string
  timestamp: string
}

export interface ApiResponse<T> {
  data: T
  error?: string
}
