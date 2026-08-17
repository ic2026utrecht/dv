export type Department = 'Parkeer' | 'Dienstverlening' | 'EHBO'

export type Priority = 'Critical' | 'Hoog' | 'Middel' | 'Laag'

export interface SelectOption {
  value: string
  label: string
}

export interface SectorRange {
  from: string
  to: string
}

export interface Location {
  id: string
  name: string
  zone: string
  active: boolean
  /** Rectangular raster ranges; empty = unrestricted (full A–M × 1–22). */
  sectorRanges?: SectorRange[]
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
  locationId?: string
  locationName: string
  zone: string
  sectorRow?: string
  sectorColumn?: number | null
  sectorLabel?: string
  sector: string
  incidentTypeId?: string
  incidentTypeName: string
  description: string
  helpOptionIds?: string[]
  helpDeployed: string
  priority: Priority
  priorityRank: number
  reporter: string
  freeField?: string
  flagEhbo?: boolean
  flagBeveiliging?: boolean
  flagHcSafety?: boolean
  flagReiniging?: boolean
  flagVeiligheid?: boolean
  status: IncidentStatus
  actionOwner: string
  scenario?: string
  deadline: string
  lastUpdate?: string
  updateNotes?: string
  closedBy?: string
  closureResult?: string
  isOpen: boolean
  ageMinutes: number
  sourceRow: string
  latitude: number | null
  longitude: number | null
  parentId?: string | null
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
  locationId?: string
  sectorRow?: string
  sectorColumn?: number | null
  incidentTypeId: string
  priority: Priority
  helpOptionIds: string[]
  reporter?: string
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
  timestamp?: string
  department?: Department
  locationId?: string
  sectorRow?: string
  sectorColumn?: number | null
  sectorLabel?: string
  incidentTypeId?: string
  description?: string
  helpOptionIds?: string[]
  priority?: Priority
  reporter?: string
  freeField?: string
  flagEhbo?: boolean
  flagBeveiliging?: boolean
  flagHcSafety?: boolean
  flagReiniging?: boolean
  flagVeiligheid?: boolean
  actionOwner?: string
  scenario?: string
  deadline?: string
  updateNotes?: string
  updatedBy?: string
  closedBy?: string
  closureResult?: string
  latitude?: number | null
  longitude?: number | null
  parentId?: string | null
}

export interface IncidentUpdateResult {
  incidentId: string
  status: IncidentStatus
  updatedAt: string
}

export interface IncidentStatusUpdate {
  id: string
  incidentId: string
  incidentUpdateId?: string
  createdAt: string
  previousStatus?: IncidentStatus | null
  status: IncidentStatus
  updatedBy: string
  notes: string
  actionOwner: string
  closedBy: string
  closureResult: string
}

export interface IncidentUpdateEntry {
  id: string
  incidentId: string
  createdAt: string
  status: IncidentStatus
  previousStatus?: IncidentStatus | null
  updatedBy: string
  notes: string
  hasPayloadChanges: boolean
  payload?: Record<string, unknown>
}

export interface IncidentFeedRead {
  staffId: string
  incidentId: string
  lastReadAt: string
}

export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface Staff {
  id: string
  firstName: string
  lastName: string
  phone: string
  pinSetAt: string | null
  isAdmin?: boolean
  active?: boolean
  createdAt?: string
}

export type WhatsappConnectionStatus = 'disconnected' | 'qr' | 'connecting' | 'connected'

export type WhatsappMessageDirection = 'in' | 'out'

export type WhatsappMessageActionStatus = 'new' | 'handled' | 'dismissed' | 'flagged'

export interface WhatsappConnectionInfo {
  status: WhatsappConnectionStatus
  phone: string
  hasQr: boolean
  qrBase64?: string
  qrUpdatedAt?: string | null
  lastConnectedAt?: string | null
  isAdmin?: boolean
}

export interface WhatsappGroup {
  id: string
  groupJid: string
  name: string
  isMonitored: boolean
  lastMessageAt: string | null
  unreadCount: number
}

export interface WhatsappMessage {
  id: string
  externalId: string
  groupJid: string
  groupName: string
  direction: WhatsappMessageDirection
  senderName: string
  senderPhone: string
  senderJid: string
  body: string
  receivedAt: string
  actionStatus: WhatsappMessageActionStatus
  incidentId: string | null
  handledBy: string
  handledAt: string | null
  replyText: string
}

export type WhatsappFeedStatusFilter = 'actionable' | 'new' | 'all' | 'handled' | 'flagged'
export type WhatsappFeedPeriodFilter = 'today' | '24h' | 'all'
