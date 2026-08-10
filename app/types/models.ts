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

export type IncidentStatus = 'Open' | 'In behandeling' | 'Afgesloten' | string

export interface Incident {
  incidentId: string
  timestamp: string
  department: Department
  locationName: string
  zone: string
  sector: string
  incidentTypeName: string
  description: string
  helpDeployed: string
  priority: Priority
  priorityRank: number
  reporter: string
  status: IncidentStatus
  actionOwner: string
  deadline: string
  isOpen: boolean
  ageMinutes: number
  sourceRow: string
  latitude: number | null
  longitude: number | null
}

export interface SitrepSummary {
  total: number
  open: number
  closed: number
  criticalOpen: number
  hoogOpen: number
  byDepartment: Record<Department, number>
}

export interface IncidentConfig {
  departments: SelectOption[]
  priorities: SelectOption[]
  locations: Location[]
  incidentTypes: IncidentType[]
  helpOptions: HelpOption[]
  raster: RasterConfig
  personsCountOptions: SelectOption[]
  supportedActions?: string[]
  apiVersion?: number
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
  latitude?: number
  longitude?: number
}

export interface IncidentSubmissionResult {
  incidentId: string
  timestamp: string
}

export interface IncidentUpdate {
  incidentId: string
  status: IncidentStatus
  actionOwner?: string
  updateNotes?: string
  closedBy?: string
  closureResult?: string
}

export interface IncidentUpdateResult {
  incidentId: string
  status: IncidentStatus
  updatedAt: string
}

export interface ApiResponse<T> {
  data: T
  error?: string
}
