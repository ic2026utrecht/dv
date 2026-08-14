import type {
  Department,
  Incident,
  IncidentConfig,
  IncidentUpdate,
  Priority,
} from '~/types/models'
import {
  formatSector,
  parseSectorCode,
  RASTER_COLUMNS,
  RASTER_ROWS,
} from '~/utils/incidentOptions'

export interface IncidentEditForm {
  timestamp: string
  department: Department
  locationId: string
  sectorCode: string
  sectorLabel: string
  incidentTypeId: string
  description: string
  helpOptionIds: string[]
  priority: Priority
  reporter: string
  flagEhbo: boolean
  flagBeveiliging: boolean
  flagHcSafety: boolean
  flagReiniging: boolean
  flagVeiligheid: boolean
  status: Incident['status']
  actionOwner: string
  scenario: string
  deadline: string
  closedBy: string
  closureResult: string
  parentId: string
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function resolveLocationId(incident: Incident, config: IncidentConfig | null): string {
  if (incident.locationId) {
    return incident.locationId
  }
  if (!config) {
    return ''
  }
  const match = config.locations.find(
    location => normalizeName(location.name) === normalizeName(incident.locationName),
  )
  return match?.id ?? ''
}

function resolveIncidentTypeId(incident: Incident, config: IncidentConfig | null): string {
  if (incident.incidentTypeId) {
    return incident.incidentTypeId
  }
  if (!config) {
    return ''
  }
  const match = config.incidentTypes.find(
    type =>
      type.department === incident.department
      && normalizeName(type.name) === normalizeName(incident.incidentTypeName),
  )
  return match?.id ?? ''
}

function resolveHelpOptionIds(incident: Incident, config: IncidentConfig | null): string[] {
  if (incident.helpOptionIds?.length) {
    return [...incident.helpOptionIds]
  }
  if (!config || !incident.helpDeployed) {
    return []
  }

  const names = incident.helpDeployed.split(',').map(part => part.trim()).filter(Boolean)
  const ids: string[] = []

  for (const name of names) {
    const match = config.helpOptions.find(
      option => normalizeName(option.name) === normalizeName(name),
    )
    if (match) {
      ids.push(match.id)
    }
  }

  return ids
}

function resolveSectorCode(incident: Incident): string {
  if (incident.sectorRow && incident.sectorColumn) {
    return formatSector(incident.sectorRow, incident.sectorColumn)
  }

  const parsed = parseSectorCode(incident.sector, RASTER_ROWS, RASTER_COLUMNS)
  return parsed?.code ?? incident.sector ?? ''
}

function toDatetimeLocalValue(value: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

/** Convert datetime-local input (local wall time) back to UTC ISO for storage. */
function fromDatetimeLocalValue(value: string): string | undefined {
  if (!value) {
    return undefined
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toISOString()
}

export function incidentToEditForm(
  incident: Incident,
  config: IncidentConfig | null = null,
): IncidentEditForm {
  const sectorCode = resolveSectorCode(incident)
  const parsedSector = parseSectorCode(sectorCode, RASTER_ROWS, RASTER_COLUMNS)

  return {
    timestamp: toDatetimeLocalValue(incident.timestamp),
    department: incident.department,
    locationId: resolveLocationId(incident, config),
    sectorCode,
    sectorLabel: incident.sectorLabel || (parsedSector ? '' : incident.sector || ''),
    incidentTypeId: resolveIncidentTypeId(incident, config),
    description: incident.description || '',
    helpOptionIds: resolveHelpOptionIds(incident, config),
    priority: incident.priority,
    reporter: incident.reporter || '',
    flagEhbo: incident.flagEhbo ?? false,
    flagBeveiliging: incident.flagBeveiliging ?? false,
    flagHcSafety: incident.flagHcSafety ?? false,
    flagReiniging: incident.flagReiniging ?? false,
    flagVeiligheid: incident.flagVeiligheid ?? false,
    status: incident.status || 'Open',
    actionOwner: incident.actionOwner || '',
    scenario: incident.scenario || '',
    deadline: toDatetimeLocalValue(incident.deadline),
    closedBy: incident.closedBy || '',
    closureResult: incident.closureResult || '',
    parentId: incident.parentId || '',
  }
}

export function editFormToIncidentUpdate(
  incidentId: string,
  form: IncidentEditForm,
): IncidentUpdate {
  const parsedSector = parseSectorCode(form.sectorCode, RASTER_ROWS, RASTER_COLUMNS)
  const sectorLabel = parsedSector
    ? ''
    : (form.sectorLabel.trim() || form.sectorCode.trim())

  return {
    incidentId,
    status: form.status,
    timestamp: fromDatetimeLocalValue(form.timestamp),
    department: form.department,
    locationId: form.locationId,
    sectorRow: parsedSector?.row ?? '',
    sectorColumn: parsedSector?.column ?? null,
    sectorLabel,
    incidentTypeId: form.incidentTypeId,
    description: form.description.trim(),
    helpOptionIds: form.helpOptionIds,
    priority: form.priority,
    reporter: form.reporter.trim(),
    flagEhbo: form.flagEhbo,
    flagBeveiliging: form.flagBeveiliging,
    flagHcSafety: form.flagHcSafety,
    flagReiniging: form.flagReiniging,
    flagVeiligheid: form.flagVeiligheid,
    actionOwner: form.actionOwner.trim(),
    scenario: form.scenario.trim(),
    deadline: fromDatetimeLocalValue(form.deadline),
    closedBy: form.closedBy.trim() || undefined,
    closureResult: form.closureResult.trim() || undefined,
    parentId: (form.parentId ?? '').trim() || null,
  }
}
