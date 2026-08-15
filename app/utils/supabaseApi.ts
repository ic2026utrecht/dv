import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ConfigResponse,
  SubmitIncidentResponse,
  IncidentsResponse,
  UpdateIncidentResponse,
  IncidentStatusHistoryResponse,
  IncidentUpdateHistoryResponse,
  IncidentFeedUnreadCounts,
} from '~/types/api'
import type {
  Department,
  HelpOption,
  Incident,
  IncidentConfig,
  IncidentStatusUpdate,
  IncidentUpdateEntry,
  IncidentSubmission,
  IncidentType,
  IncidentUpdate,
  Location,
  Priority,
} from '~/types/models'
import { PERSONS_COUNT_OPTIONS } from '~/constants/incident'
import { INCIDENT_CONFIG_API_VERSION } from '~/utils/incidentConfigCache'
import { parseSectorRangesJson, RASTER_COLUMNS, RASTER_ROWS } from '~/utils/incidentOptions'

export function assertSupabaseConfig(url: string, anonKey: string): void {
  if (!url || !anonKey || anonKey.includes('YOUR_')) {
    throw new Error(
      'NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY must be set. Copy .env.example to .env.',
    )
  }
}

interface IncidentViewRow {
  incident_id: string
  timestamp: string
  department: Department
  location_name: string
  zone: string
  sector: string
  incident_type_name: string
  description: string
  help_deployed: string
  priority: Priority
  priority_rank: number
  reporter: string
  status: string
  action_owner: string
  deadline: string | null
  is_open: boolean
  age_minutes: number | null
  source_row: string
  latitude: number | null
  longitude: number | null
  free_field: string
  scenario: string
  flag_ehbo: boolean
  flag_beveiliging: boolean
  flag_hc_safety: boolean
  flag_reiniging: boolean
  flag_veiligheid: boolean
  last_update: string | null
  update_notes: string
  closed_by: string
  closure_result: string
  location_id: string | null
  sector_row: string
  sector_column: number | null
  incident_type_id: string | null
  help_option_ids: string
  parent_id: string | null
}

interface IncidentStatusUpdateRow {
  id: string
  incident_id: string
  incident_update_id: string | null
  created_at: string
  previous_status: string | null
  status: string
  updated_by: string
  notes: string
  action_owner: string
  closed_by: string
  closure_result: string
}

interface IncidentUpdateRow {
  id: string
  incident_id: string
  created_at: string
  status: string
  notes: string
  updated_by: string
  payload: Record<string, unknown> | null
}

function payloadHasChanges(payload: Record<string, unknown> | null): boolean {
  if (!payload) {
    return false
  }
  return Object.values(payload).some((value) => {
    if (value === null || value === undefined || value === '') {
      return false
    }
    if (Array.isArray(value) && value.length === 0) {
      return false
    }
    return true
  })
}

function mapStatusUpdateRow(row: IncidentStatusUpdateRow): IncidentStatusUpdate {
  return {
    id: row.id,
    incidentId: row.incident_id,
    incidentUpdateId: row.incident_update_id ?? undefined,
    createdAt: row.created_at,
    previousStatus: row.previous_status ?? null,
    status: row.status,
    updatedBy: row.updated_by ?? '',
    notes: row.notes ?? '',
    actionOwner: row.action_owner ?? '',
    closedBy: row.closed_by ?? '',
    closureResult: row.closure_result ?? '',
  }
}

function mapIncidentUpdateRows(rows: IncidentUpdateRow[]): IncidentUpdateEntry[] {
  return rows.map((row, index) => {
    const previousStatus = index > 0 ? rows[index - 1]!.status : null
    return {
      id: row.id,
      incidentId: row.incident_id,
      createdAt: row.created_at,
      status: row.status,
      previousStatus: index === 0 ? null : previousStatus,
      updatedBy: row.updated_by ?? '',
      notes: row.notes ?? '',
      hasPayloadChanges: payloadHasChanges(row.payload),
      payload: row.payload ?? {},
    }
  })
}

function mapViewRow(row: IncidentViewRow): Incident {
  const helpOptionIds = row.help_option_ids
    ? row.help_option_ids.split(',').map(part => part.trim()).filter(Boolean)
    : []

  const sectorColumn = row.sector_column != null ? Number(row.sector_column) : null

  return {
    incidentId: row.incident_id,
    timestamp: row.timestamp ?? '',
    department: row.department,
    locationId: row.location_id ?? undefined,
    locationName: row.location_name ?? '',
    zone: row.zone ?? '',
    sectorRow: row.sector_row || undefined,
    sectorColumn: sectorColumn != null && !Number.isNaN(sectorColumn) ? sectorColumn : null,
    sectorLabel: row.sector_row || row.sector_column != null ? '' : (row.sector || undefined),
    sector: row.sector ?? '',
    incidentTypeId: row.incident_type_id ?? undefined,
    incidentTypeName: row.incident_type_name ?? '',
    description: row.description ?? '',
    helpOptionIds: helpOptionIds.length ? helpOptionIds : undefined,
    helpDeployed: row.help_deployed ?? '',
    priority: row.priority,
    priorityRank: Number(row.priority_rank) || 4,
    reporter: row.reporter ?? '',
    freeField: row.free_field || undefined,
    flagEhbo: row.flag_ehbo ?? false,
    flagBeveiliging: row.flag_beveiliging ?? false,
    flagHcSafety: row.flag_hc_safety ?? false,
    flagReiniging: row.flag_reiniging ?? false,
    flagVeiligheid: row.flag_veiligheid ?? false,
    status: row.status ?? 'Open',
    actionOwner: row.action_owner ?? '',
    scenario: row.scenario || undefined,
    deadline: row.deadline ?? '',
    lastUpdate: row.last_update ?? undefined,
    updateNotes: row.update_notes || undefined,
    closedBy: row.closed_by || undefined,
    closureResult: row.closure_result || undefined,
    isOpen: row.is_open === true,
    ageMinutes: Number(row.age_minutes) || 0,
    sourceRow: row.source_row ?? '',
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    parentId: row.parent_id || null,
  }
}

function buildUpdatePayload(payload: IncidentUpdate): Record<string, unknown> {
  const {
    incidentId: _incidentId,
    status: _status,
    updateNotes: _updateNotes,
    updatedBy: _updatedBy,
    ...rest
  } = payload
  return rest as Record<string, unknown>
}

function resolveHelpOptionIds(
  helpOptionIds: string[],
  helpOptions: HelpOption[],
  ambulanceCalled?: boolean,
): string {
  const ids = [...helpOptionIds]
  if (ambulanceCalled === true) {
    const help112 = helpOptions.find(
      opt => opt.name.trim().toLowerCase() === '112 gebeld',
    )
    if (help112 && !ids.includes(help112.id)) {
      ids.push(help112.id)
    }
  }
  return ids.join(',')
}

function appendEhboDescription(description: string, personsInvolved?: number): string {
  let result = description.trim()
  if (personsInvolved) {
    result += ` [betrokkenen: ${personsInvolved}]`
  }
  return result
}

function validateSubmission(body: IncidentSubmission): void {
  const required: (keyof IncidentSubmission)[] = [
    'department', 'incidentTypeId', 'priority', 'description',
  ]
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === '') {
      throw new Error(`Verplicht veld ontbreekt: ${key}`)
    }
  }

  const hasLocation = Boolean(body.locationId?.trim())
  const hasSector = Boolean(body.sectorRow?.trim()) && body.sectorColumn != null
  if (!hasLocation && !hasSector) {
    throw new Error('Locatie of raster sector is verplicht')
  }

  if (hasSector) {
    if (!RASTER_ROWS.includes(body.sectorRow!)) {
      throw new Error('Ongeldige raster rij')
    }
    const col = Number(body.sectorColumn)
    if (Number.isNaN(col) || col < 1 || col > 22) {
      throw new Error('Ongeldige raster kolom')
    }
  }

  if (body.department === 'EHBO') {
    if (!body.personsInvolved) throw new Error('Aantal betrokkenen verplicht voor EHBO')
    if (body.ambulanceCalled === undefined || body.ambulanceCalled === null) {
      throw new Error('112 gebeld? verplicht voor EHBO')
    }
  }
}

export async function fetchSupabaseConfig(client: SupabaseClient): Promise<ConfigResponse> {
  const [locationsRes, typesRes, helpRes] = await Promise.all([
    client.from('locations').select('*').eq('active', true).order('name'),
    client.from('incident_types').select('*').eq('active', true).order('name'),
    client.from('help_options').select('*').eq('active', true).order('name'),
  ])

  if (locationsRes.error) throw new Error(locationsRes.error.message)
  if (typesRes.error) throw new Error(typesRes.error.message)
  if (helpRes.error) throw new Error(helpRes.error.message)

  const locations: Location[] = (locationsRes.data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    zone: row.zone ?? '',
    active: row.active !== false,
    sectorRanges: parseSectorRangesJson(row.sector_ranges),
  }))

  const incidentTypes: IncidentType[] = (typesRes.data ?? []).map(row => ({
    id: row.id,
    department: row.department as Department,
    name: row.name,
  }))

  const helpOptions: HelpOption[] = (helpRes.data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    departments: (row.departments ?? []) as Department[],
  }))

  const config: IncidentConfig = {
    departments: [
      { value: 'Parkeer', label: 'Parkeer' },
      { value: 'Dienstverlening', label: 'Dienstverlening' },
      { value: 'EHBO', label: 'EHBO' },
    ],
    priorities: [
      { value: 'Laag', label: 'Laag' },
      { value: 'Middel', label: 'Middel' },
      { value: 'Hoog', label: 'Hoog' },
      { value: 'Critical', label: 'Critical' },
    ],
    supportedActions: ['config', 'submit', 'incidents', 'update'],
    apiVersion: INCIDENT_CONFIG_API_VERSION,
    locations,
    incidentTypes,
    helpOptions,
    raster: {
      rows: [...RASTER_ROWS],
      columns: [...RASTER_COLUMNS],
    },
    personsCountOptions: PERSONS_COUNT_OPTIONS,
  }

  return { data: config }
}

export async function fetchSupabaseIncidents(client: SupabaseClient): Promise<IncidentsResponse> {
  const { data, error } = await client
    .from('incidents_view')
    .select('*')
    .order('timestamp', { ascending: false })

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []).map(row => mapViewRow(row as IncidentViewRow)),
  }
}

export async function postSupabaseIncident(
  client: SupabaseClient,
  payload: IncidentSubmission,
  helpOptions: HelpOption[] = [],
): Promise<SubmitIncidentResponse> {
  validateSubmission(payload)

  const description = appendEhboDescription(payload.description, payload.personsInvolved)
  const helpOptionIds = resolveHelpOptionIds(
    payload.helpOptionIds ?? [],
    helpOptions,
    payload.ambulanceCalled,
  )

  const { data, error } = await client.rpc('submit_public_incident', {
    p_department: payload.department,
    p_location_id: payload.locationId?.trim() || null,
    p_sector_row: payload.sectorRow ?? '',
    p_sector_column: payload.sectorColumn ?? null,
    p_incident_type_id: payload.incidentTypeId,
    p_description: description,
    p_help_option_ids: helpOptionIds,
    p_priority: payload.priority,
    p_reporter: payload.reporter?.trim() ?? '',
    p_latitude: payload.latitude ?? null,
    p_longitude: payload.longitude ?? null,
  })

  if (error) throw new Error(error.message)

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.incident_id) throw new Error('Ongeldig antwoord van Supabase')

  return {
    data: {
      incidentId: row.incident_id,
      timestamp: row.timestamp,
    },
  }
}

export async function fetchSupabaseIncidentStatusHistory(
  client: SupabaseClient,
  incidentId: string,
): Promise<IncidentStatusHistoryResponse> {
  if (!incidentId.trim()) {
    throw new Error('incidentId verplicht')
  }

  const { data, error } = await client
    .from('incident_status_updates')
    .select('*')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []).map(row => mapStatusUpdateRow(row as IncidentStatusUpdateRow)),
  }
}

export async function fetchSupabaseIncidentUpdates(
  client: SupabaseClient,
  incidentId: string,
): Promise<IncidentUpdateHistoryResponse> {
  if (!incidentId.trim()) {
    throw new Error('incidentId verplicht')
  }

  const { data, error } = await client
    .from('incident_updates')
    .select('id, incident_id, created_at, status, notes, updated_by, payload')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw new Error(error.message)

  return {
    data: mapIncidentUpdateRows((data ?? []) as IncidentUpdateRow[]),
  }
}

/** Aggregated update notes per incident for sitrep full-text search. */
export async function fetchSupabaseIncidentUpdateNotesIndex(
  client: SupabaseClient,
): Promise<Record<string, string>> {
  const { data, error } = await client
    .from('incident_updates')
    .select('incident_id, notes')
    .neq('notes', '')

  if (error) throw new Error(error.message)

  const index: Record<string, string> = {}
  for (const row of data ?? []) {
    const incidentId = String(row.incident_id ?? '').trim()
    const note = String(row.notes ?? '').trim()
    if (!incidentId || !note) {
      continue
    }
    index[incidentId] = index[incidentId] ? `${index[incidentId]} ${note}` : note
  }
  return index
}

export async function postSupabaseIncidentUpdate(
  client: SupabaseClient,
  payload: IncidentUpdate,
): Promise<UpdateIncidentResponse> {
  if (!payload.incidentId) throw new Error('incidentId verplicht')
  if (!payload.status) throw new Error('status verplicht')

  const allowed = ['Open', 'In behandeling', 'Afgesloten']
  if (!allowed.includes(String(payload.status))) {
    throw new Error('Ongeldige status')
  }

  const updatePayload = buildUpdatePayload(payload)
  const updatedBy = payload.updatedBy?.trim()
    || payload.closedBy?.trim()
    || payload.actionOwner?.trim()
    || payload.reporter?.trim()
    || ''

  const { data, error } = await client
    .from('incident_updates')
    .insert({
      incident_id: payload.incidentId,
      status: payload.status,
      notes: payload.updateNotes?.trim() ?? '',
      updated_by: updatedBy,
      payload: updatePayload,
    })
    .select('incident_id, status, created_at')
    .single()

  if (error) throw new Error(error.message)
  if (!data?.incident_id) throw new Error('Ongeldig antwoord van Supabase')

  return {
    data: {
      incidentId: data.incident_id,
      status: data.status,
      updatedAt: data.created_at,
    },
  }
}

export async function deleteSupabaseIncidentUpdate(
  client: SupabaseClient,
  updateId: string,
): Promise<void> {
  const trimmedId = updateId.trim()
  if (!trimmedId) {
    throw new Error('Update-id verplicht')
  }

  const { data, error } = await client
    .from('incident_updates')
    .delete()
    .eq('id', trimmedId)
    .select('id')

  if (error) throw new Error(error.message)
  if (!data?.length) {
    throw new Error('Update niet gevonden of geen rechten om te verwijderen')
  }
}

interface IncidentFeedUnreadCountRow {
  incident_id: string
  unread_count: number | string
}

export async function fetchSupabaseIncidentFeedUnreadCounts(
  client: SupabaseClient,
): Promise<IncidentFeedUnreadCounts> {
  const { data, error } = await client.rpc('get_incident_feed_unread_counts')

  if (error) throw new Error(error.message)

  const counts: IncidentFeedUnreadCounts = {}
  for (const row of (data ?? []) as IncidentFeedUnreadCountRow[]) {
    const incidentId = String(row.incident_id ?? '').trim()
    if (!incidentId) {
      continue
    }
    counts[incidentId] = Number(row.unread_count) || 0
  }
  return counts
}

export async function markSupabaseIncidentFeedRead(
  client: SupabaseClient,
  incidentId: string,
  readAt?: string,
): Promise<void> {
  const trimmedId = incidentId.trim()
  if (!trimmedId) {
    throw new Error('incidentId verplicht')
  }

  const params: { p_incident_id: string, p_read_at?: string } = {
    p_incident_id: trimmedId,
  }
  if (readAt) {
    params.p_read_at = readAt
  }

  const { error } = await client.rpc('mark_incident_feed_read', params)
  if (error) throw new Error(error.message)
}
