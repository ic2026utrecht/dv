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
  personsInvolved: string
  ambulanceCalled: 'ja' | 'nee' | null
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

const BETROKKENEN_SUFFIX_RE = /\s*\[betrokkenen:\s*(\d+)\]\s*$/i

function findHelp112OptionId(config: IncidentConfig | null): string | undefined {
  return config?.helpOptions.find(
    option => option.name.trim().toLowerCase() === '112 gebeld',
  )?.id
}

function parseEhboFromDescription(description: string): {
  cleanDescription: string
  personsInvolved: string
} {
  const match = description.match(BETROKKENEN_SUFFIX_RE)
  if (!match) {
    return { cleanDescription: description, personsInvolved: '' }
  }

  return {
    cleanDescription: description.replace(BETROKKENEN_SUFFIX_RE, '').trimEnd(),
    personsInvolved: match[1] ?? '',
  }
}

function formatEhboDescription(description: string, personsInvolved: string): string {
  const clean = description.replace(BETROKKENEN_SUFFIX_RE, '').trim()
  if (!personsInvolved) {
    return clean
  }

  return `${clean} [betrokkenen: ${personsInvolved}]`
}

function resolveAmbulanceCalled(
  helpOptionIds: string[],
  config: IncidentConfig | null,
): 'ja' | 'nee' | null {
  const help112Id = findHelp112OptionId(config)
  if (!help112Id) {
    return null
  }

  return helpOptionIds.includes(help112Id) ? 'ja' : 'nee'
}

function applyAmbulanceToHelpOptionIds(
  helpOptionIds: string[],
  config: IncidentConfig | null,
  ambulanceCalled: 'ja' | 'nee' | null,
): string[] {
  const help112Id = findHelp112OptionId(config)
  const filtered = help112Id
    ? helpOptionIds.filter(id => id !== help112Id)
    : [...helpOptionIds]

  if (ambulanceCalled === 'ja' && help112Id) {
    filtered.push(help112Id)
  }

  return filtered
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
  const ehboDescription = parseEhboFromDescription(incident.description || '')
  const resolvedHelpOptionIds = resolveHelpOptionIds(incident, config)
  const help112Id = findHelp112OptionId(config)

  return {
    timestamp: toDatetimeLocalValue(incident.timestamp),
    department: incident.department,
    locationId: resolveLocationId(incident, config),
    sectorCode,
    sectorLabel: incident.sectorLabel || (parsedSector ? '' : incident.sector || ''),
    incidentTypeId: resolveIncidentTypeId(incident, config),
    description: ehboDescription.cleanDescription,
    helpOptionIds: help112Id
      ? resolvedHelpOptionIds.filter(id => id !== help112Id)
      : resolvedHelpOptionIds,
    priority: incident.priority,
    reporter: incident.reporter || '',
    personsInvolved: incident.department === 'EHBO' ? ehboDescription.personsInvolved : '',
    ambulanceCalled: incident.department === 'EHBO'
      ? resolveAmbulanceCalled(resolvedHelpOptionIds, config)
      : null,
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
  previous: Incident | null = null,
  config: IncidentConfig | null = null,
): IncidentUpdate {
  const parsedSector = parseSectorCode(form.sectorCode, RASTER_ROWS, RASTER_COLUMNS)
  const sectorLabel = parsedSector
    ? ''
    : (form.sectorLabel.trim() || form.sectorCode.trim())
  const locationId = form.locationId
  const sectorRow = parsedSector?.row ?? ''
  const sectorColumn = parsedSector?.column ?? null
  const description = form.department === 'EHBO'
    ? formatEhboDescription(form.description, form.personsInvolved)
    : form.description.trim()
  const helpOptionIds = form.department === 'EHBO'
    ? applyAmbulanceToHelpOptionIds(form.helpOptionIds, config, form.ambulanceCalled)
    : form.helpOptionIds

  const update: IncidentUpdate = {
    incidentId,
    status: form.status,
    timestamp: fromDatetimeLocalValue(form.timestamp),
    department: form.department,
    incidentTypeId: form.incidentTypeId,
    description,
    helpOptionIds,
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

  const locationChanged = !previous || locationFieldsChanged(previous, {
    locationId,
    sectorRow,
    sectorColumn,
    sectorLabel,
  })

  if (locationChanged) {
    update.locationId = locationId
    update.sectorRow = sectorRow
    update.sectorColumn = sectorColumn
    update.sectorLabel = sectorLabel
  }

  return update
}

function locationFieldsChanged(
  previous: Incident,
  next: {
    locationId: string
    sectorRow: string
    sectorColumn: number | null
    sectorLabel: string
  },
): boolean {
  const prevLocationId = previous.locationId ?? ''
  const prevSectorRow = previous.sectorRow ?? ''
  const prevSectorColumn = previous.sectorColumn ?? null
  const prevSectorLabel = previous.sectorLabel
    || (!previous.sectorRow && !previous.sectorColumn ? (previous.sector || '') : '')

  return (
    prevLocationId !== next.locationId
    || prevSectorRow !== next.sectorRow
    || prevSectorColumn !== next.sectorColumn
    || prevSectorLabel !== next.sectorLabel
  )
}
