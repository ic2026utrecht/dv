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

export interface IncidentExportIndexRow {
  incident_id: string
  priority: Priority
  parent_id: string | null
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

export function matchedExportIncidentIds(
  rows: Array<{ incident_id: string, priority: string }>,
  filters: IncidentExportFilters,
): Set<string> {
  const matched = new Set<string>()
  for (const row of rows) {
    if (matchesIncidentExportFilters(row.incident_id, row.priority, filters)) {
      matched.add(row.incident_id)
    }
  }
  return matched
}

/** Filter matches plus every sub-incident of a matched parent. */
export function expandExportIncidentIds(
  rows: Array<{ incident_id: string, priority: string, parent_id?: string | null }>,
  filters: IncidentExportFilters,
): Set<string> {
  const selected = matchedExportIncidentIds(rows, filters)
  for (const row of rows) {
    const parentId = String(row.parent_id ?? '').trim()
    if (parentId && selected.has(parentId) && row.incident_id) {
      selected.add(row.incident_id)
    }
  }
  return selected
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

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).trim()
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function payloadObject(update: JsonRecord): Record<string, unknown> {
  const payload = update.payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>
  }
  return {}
}

export interface ExportLocationSnapshot {
  location_id: string
  location_name: string
  zone: string
  sector_row: string
  sector_column: number | null
  sector_label: string
  sector: string
  latitude: number | null
  longitude: number | null
}

function emptyLocationSnapshot(): ExportLocationSnapshot {
  return {
    location_id: '',
    location_name: '',
    zone: '',
    sector_row: '',
    sector_column: null,
    sector_label: '',
    sector: '',
    latitude: null,
    longitude: null,
  }
}

function decorateLocationSnapshot(
  snapshot: ExportLocationSnapshot,
  locations: Map<string, JsonRecord>,
): ExportLocationSnapshot {
  const location = locations.get(snapshot.location_id)
  return {
    ...snapshot,
    location_name: location ? asTrimmedString(location.name) : snapshot.location_id,
    zone: location ? asTrimmedString(location.zone) : '',
    sector: formatIncidentSector({
      sector_row: snapshot.sector_row,
      sector_column: snapshot.sector_column,
      sector_label: snapshot.sector_label,
    }),
  }
}

function applyLocationPayload(
  previous: ExportLocationSnapshot,
  payload: Record<string, unknown>,
  locations: Map<string, JsonRecord>,
): ExportLocationSnapshot {
  const next = { ...previous }

  if ('locationId' in payload) {
    next.location_id = asTrimmedString(payload.locationId)
  }
  if ('sectorRow' in payload) {
    next.sector_row = asTrimmedString(payload.sectorRow)
  }
  if ('sectorColumn' in payload) {
    next.sector_column = asNumberOrNull(payload.sectorColumn)
  }
  if ('sectorLabel' in payload) {
    next.sector_label = asTrimmedString(payload.sectorLabel)
  }
  if ('latitude' in payload) {
    next.latitude = asNumberOrNull(payload.latitude)
  }
  if ('longitude' in payload) {
    next.longitude = asNumberOrNull(payload.longitude)
  }

  return decorateLocationSnapshot(next, locations)
}

function locationSnapshotsEqual(a: ExportLocationSnapshot, b: ExportLocationSnapshot): boolean {
  return (
    a.location_id === b.location_id
    && a.sector_row === b.sector_row
    && a.sector_column === b.sector_column
    && a.sector_label === b.sector_label
    && a.latitude === b.latitude
    && a.longitude === b.longitude
  )
}

function sortUpdates(updates: JsonRecord[]): JsonRecord[] {
  return [...updates].sort((a, b) => {
    const created = asTrimmedString(a.created_at).localeCompare(asTrimmedString(b.created_at))
    if (created !== 0) {
      return created
    }
    return asTrimmedString(a.id).localeCompare(asTrimmedString(b.id))
  })
}

export function buildLocationHistory(
  incidentId: string,
  updates: JsonRecord[],
  locations: Map<string, JsonRecord>,
): {
  updates: JsonRecord[]
  location_updates: JsonRecord[]
} {
  const sorted = sortUpdates(updates)
  let previous = emptyLocationSnapshot()
  const locationUpdates: JsonRecord[] = []

  const annotated = sorted.map((update, index) => {
    const current = applyLocationPayload(previous, payloadObject(update), locations)
    const changed = !locationSnapshotsEqual(previous, current)
    const locationChange = index > 0 && changed
      ? { from: previous, to: current }
      : null

    if (index === 0 || locationChange) {
      locationUpdates.push({
        incident_id: incidentId,
        incident_update_id: update.id ?? null,
        created_at: update.created_at ?? null,
        updated_by: update.updated_by ?? '',
        initial: index === 0,
        from: index === 0 ? null : previous,
        to: current,
      })
    }

    previous = current
    return {
      ...update,
      location: current,
      location_change: locationChange,
    }
  })

  return {
    updates: annotated,
    location_updates: locationUpdates,
  }
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
  matchedIds: Set<string>
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
  const allLocationUpdates: JsonRecord[] = []

  const nestedIncidents = input.incidents.map((incident) => {
    const incidentId = String(incident.incident_id ?? '')
    const parentId = String(incident.parent_id ?? '').trim()
    const helpIds = splitHelpOptionIds(incident.help_option_ids)
    const history = buildLocationHistory(
      incidentId,
      updatesByIncident.get(incidentId) ?? [],
      locations,
    )
    allLocationUpdates.push(...history.location_updates)

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
      included_because: input.matchedIds.has(incidentId) ? 'filter' : 'subincident',
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
      updates: history.updates,
      location_updates: history.location_updates,
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
        matched_by_filter: input.matchedIds.size,
        sub_incidents_added: Math.max(0, input.incidents.length - input.matchedIds.size),
        incident_updates: input.updates.length,
        location_updates: allLocationUpdates.length,
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
      location_updates: allLocationUpdates,
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
