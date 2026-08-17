import type { Priority } from '~/types/models'

export const INCIDENT_EXPORT_FORMAT = 'ic2026-incident-export-v1'

export interface IncidentExportFilters {
  numberFrom: number | null
  numberTo: number | null
  priorities: Priority[]
}

export type JsonRecord = Record<string, unknown>

const INCIDENT_NUMBER_RE = /^(?:INC-2026-)?0*([1-9][0-9]*)$/i
const INCIDENT_ID_NUMBER_RE = /^INC-2026-0*([0-9]+)$/i

export function parseIncidentNumberInput(value: string): { ok: true, value: number | null } | { ok: false, message: string } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { ok: true, value: null }
  }

  const match = trimmed.match(INCIDENT_NUMBER_RE)
  if (!match) {
    return { ok: false, message: 'Gebruik een nummer of INC-2026-…' }
  }

  const parsed = Number(match[1])
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return { ok: false, message: 'Ongeldig incidentnummer' }
  }

  return { ok: true, value: parsed }
}

export function incidentIdNumber(incidentId: string): number | null {
  const match = String(incidentId ?? '').trim().match(INCIDENT_ID_NUMBER_RE)
  if (!match) {
    return null
  }
  const parsed = Number(match[1])
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function matchesIncidentExportFilters(
  incidentId: string,
  priority: string,
  filters: IncidentExportFilters,
): boolean {
  if (filters.priorities.length && !filters.priorities.includes(priority as Priority)) {
    return false
  }

  const hasRange = filters.numberFrom != null || filters.numberTo != null
  if (!hasRange) {
    return true
  }

  const number = incidentIdNumber(incidentId)
  if (number == null) {
    return false
  }
  if (filters.numberFrom != null && number < filters.numberFrom) {
    return false
  }
  if (filters.numberTo != null && number > filters.numberTo) {
    return false
  }
  return true
}

export function splitHelpOptionIds(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) {
    return []
  }
  return value.split(',').map(part => part.trim()).filter(Boolean)
}

export function formatIncidentSector(row: JsonRecord): string {
  const label = String(row.sector_label ?? '').trim()
  if (label) {
    return label
  }
  const rowKey = String(row.sector_row ?? '').trim()
  const column = row.sector_column
  if (rowKey && column != null && column !== '') {
    return `${rowKey}${column}`
  }
  return ''
}

const CSV_COLUMNS = [
  'incident_id',
  'timestamp',
  'department',
  'priority',
  'status',
  'location_id',
  'location_name',
  'zone',
  'sector_row',
  'sector_column',
  'sector_label',
  'sector',
  'incident_type_id',
  'incident_type_name',
  'description',
  'help_option_ids',
  'help_deployed',
  'reporter',
  'action_owner',
  'deadline',
  'closed_by',
  'closure_result',
  'source_row',
  'latitude',
  'longitude',
  'free_field',
  'scenario',
  'flag_ehbo',
  'flag_beveiliging',
  'flag_hc_safety',
  'flag_reiniging',
  'flag_veiligheid',
  'parent_id',
  'updated_at',
] as const

function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function incidentsToCsv(rows: JsonRecord[]): string {
  const header = CSV_COLUMNS.join(',')
  const lines = rows.map(row => CSV_COLUMNS.map(column => csvCell(row[column])).join(','))
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`
}

export function flattenIncidentForCsv(
  incident: JsonRecord,
  location: JsonRecord | undefined,
  incidentType: JsonRecord | undefined,
  helpOptions: JsonRecord[],
): JsonRecord {
  return {
    ...incident,
    location_name: location?.name ?? '',
    zone: location?.zone ?? '',
    sector: formatIncidentSector(incident),
    incident_type_name: incidentType?.name ?? '',
    help_deployed: helpOptions.map(option => String(option.name ?? '')).filter(Boolean).join(', '),
  }
}

export function byId(rows: JsonRecord[], key = 'id'): Map<string, JsonRecord> {
  const map = new Map<string, JsonRecord>()
  for (const row of rows) {
    const id = String(row[key] ?? '').trim()
    if (id) {
      map.set(id, row)
    }
  }
  return map
}

export function groupBy(rows: JsonRecord[], key: string): Map<string, JsonRecord[]> {
  const map = new Map<string, JsonRecord[]>()
  for (const row of rows) {
    const id = String(row[key] ?? '').trim()
    if (!id) {
      continue
    }
    const list = map.get(id)
    if (list) {
      list.push(row)
    }
    else {
      map.set(id, [row])
    }
  }
  return map
}

function relatedIncidentSummary(
  incident: JsonRecord | undefined,
  locations: Map<string, JsonRecord>,
  types: Map<string, JsonRecord>,
  helpOptions: Map<string, JsonRecord>,
): JsonRecord | null {
  if (!incident) {
    return null
  }
  return {
    ...incident,
    location: locations.get(String(incident.location_id ?? '')) ?? null,
    incident_type: types.get(String(incident.incident_type_id ?? '')) ?? null,
    help_options: splitHelpOptionIds(incident.help_option_ids)
      .map(id => helpOptions.get(id))
      .filter((row): row is JsonRecord => Boolean(row)),
  }
}

export function buildIncidentExportJson(input: {
  filters: IncidentExportFilters
  incidents: JsonRecord[]
  relatedIncidents: JsonRecord[]
  locations: JsonRecord[]
  incidentTypes: JsonRecord[]
  helpOptions: JsonRecord[]
  updates: JsonRecord[]
  statusUpdates: JsonRecord[]
  whatsappActions: JsonRecord[]
  whatsappMessages: JsonRecord[]
  whatsappGroups: JsonRecord[]
}): JsonRecord {
  const locations = byId(input.locations)
  const types = byId(input.incidentTypes)
  const helpOptions = byId(input.helpOptions)
  const relatedIncidents = byId(input.relatedIncidents, 'incident_id')
  const childrenByParent = groupBy(input.relatedIncidents, 'parent_id')
  const updatesByIncident = groupBy(input.updates, 'incident_id')
  const statusByIncident = groupBy(input.statusUpdates, 'incident_id')
  const actionsByIncident = groupBy(input.whatsappActions, 'incident_id')
  const messages = byId(input.whatsappMessages)
  const groups = byId(input.whatsappGroups, 'group_jid')

  const nestedIncidents = input.incidents.map((incident) => {
    const incidentId = String(incident.incident_id ?? '')
    const parentId = String(incident.parent_id ?? '').trim()
    const helpIds = splitHelpOptionIds(incident.help_option_ids)

    const whatsappMessages = (actionsByIncident.get(incidentId) ?? []).map((action) => {
      const message = messages.get(String(action.message_id ?? ''))
      const groupJid = String(message?.group_jid ?? '')
      return {
        ...message,
        group: groups.get(groupJid) ?? null,
        action,
      }
    })

    return {
      ...incident,
      sector: formatIncidentSector(incident),
      location: locations.get(String(incident.location_id ?? '')) ?? null,
      incident_type: types.get(String(incident.incident_type_id ?? '')) ?? null,
      help_options: helpIds
        .map(id => helpOptions.get(id))
        .filter((row): row is JsonRecord => Boolean(row)),
      parent: parentId
        ? relatedIncidentSummary(relatedIncidents.get(parentId), locations, types, helpOptions)
        : null,
      children: (childrenByParent.get(incidentId) ?? [])
        .map(child => relatedIncidentSummary(child, locations, types, helpOptions))
        .filter((row): row is JsonRecord => Boolean(row)),
      updates: updatesByIncident.get(incidentId) ?? [],
      status_updates: statusByIncident.get(incidentId) ?? [],
      whatsapp_messages: whatsappMessages,
    }
  })

  return {
    meta: {
      exported_at: new Date().toISOString(),
      format: INCIDENT_EXPORT_FORMAT,
      purpose: 'AI input and data analysis',
      filters: {
        incident_number_from: input.filters.numberFrom,
        incident_number_to: input.filters.numberTo,
        priorities: input.filters.priorities,
      },
      counts: {
        incidents: input.incidents.length,
        incident_updates: input.updates.length,
        incident_status_updates: input.statusUpdates.length,
        whatsapp_messages: input.whatsappMessages.length,
        whatsapp_message_actions: input.whatsappActions.length,
        whatsapp_groups: input.whatsappGroups.length,
        locations: input.locations.length,
        incident_types: input.incidentTypes.length,
        help_options: input.helpOptions.length,
      },
    },
    incidents: nestedIncidents,
    tables: {
      incidents: input.incidents,
      incident_updates: input.updates,
      incident_status_updates: input.statusUpdates,
      locations: input.locations,
      incident_types: input.incidentTypes,
      help_options: input.helpOptions,
      whatsapp_messages: input.whatsappMessages,
      whatsapp_message_actions: input.whatsappActions,
      whatsapp_groups: input.whatsappGroups,
    },
  }
}

export function exportFilename(extension: 'csv' | 'json'): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('')
  return `incidenten-export-${stamp}.${extension}`
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
