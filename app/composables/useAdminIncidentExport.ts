import type { Priority } from '~/types/models'
import {
  buildIncidentExportJson,
  byId,
  downloadTextFile,
  expandExportIncidentIds,
  exportFilename,
  flattenIncidentForCsv,
  incidentsToCsv,
  matchedExportIncidentIds,
  splitHelpOptionIds,
  type IncidentExportFilters,
  type IncidentExportIndexRow,
  type JsonRecord,
} from '~/utils/incidentExport'

const PAGE_SIZE = 1000
const IN_CHUNK_SIZE = 150

interface PagedQuery {
  range: (from: number, to: number) => PromiseLike<{
    data: JsonRecord[] | null
    error: { message: string } | null
  }>
}

async function fetchPaged(makeQuery: () => PagedQuery): Promise<JsonRecord[]> {
  const rows: JsonRecord[] = []
  let from = 0

  for (;;) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1)
    if (error) {
      throw new Error(error.message)
    }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) {
      break
    }
    from += PAGE_SIZE
  }

  return rows
}

async function fetchInChunks(
  ids: string[],
  fetchChunk: (chunk: string[]) => Promise<JsonRecord[]>,
): Promise<JsonRecord[]> {
  if (!ids.length) {
    return []
  }

  const unique = [...new Set(ids.filter(Boolean))]
  const rows: JsonRecord[] = []
  for (let i = 0; i < unique.length; i += IN_CHUNK_SIZE) {
    rows.push(...await fetchChunk(unique.slice(i, i + IN_CHUNK_SIZE)))
  }
  return rows
}

export function useAdminIncidentExport() {
  const supabase = useSupabaseClient()

  async function listIncidentIndex(): Promise<IncidentExportIndexRow[]> {
    const rows = await fetchPaged(() =>
      supabase
        .from('incidents')
        .select('incident_id, priority, parent_id')
        .order('incident_id', { ascending: true }) as unknown as PagedQuery,
    )

    return rows.map(row => ({
      incident_id: String(row.incident_id ?? ''),
      priority: row.priority as Priority,
      parent_id: String(row.parent_id ?? '').trim() || null,
    }))
  }

  async function exportIncidents(filters: IncidentExportFilters, format: 'csv' | 'json'): Promise<number> {
    const [incidentRows, locations, incidentTypes, helpOptions] = await Promise.all([
      fetchPaged(() =>
        supabase
          .from('incidents')
          .select('*')
          .order('incident_id', { ascending: true }) as unknown as PagedQuery,
      ),
      fetchPaged(() =>
        supabase.from('locations').select('*').order('name') as unknown as PagedQuery,
      ),
      fetchPaged(() =>
        supabase.from('incident_types').select('*').order('name') as unknown as PagedQuery,
      ),
      fetchPaged(() =>
        supabase.from('help_options').select('*').order('name') as unknown as PagedQuery,
      ),
    ])

    const indexRows = incidentRows.map(row => ({
      incident_id: String(row.incident_id ?? ''),
      priority: String(row.priority ?? ''),
      parent_id: String(row.parent_id ?? '').trim() || null,
    }))
    const matchedIds = matchedExportIncidentIds(indexRows, filters)
    const selectedIds = expandExportIncidentIds(indexRows, filters)
    const incidents = incidentRows.filter(row => selectedIds.has(String(row.incident_id ?? '')))

    if (format === 'csv') {
      const locationMap = byId(locations)
      const typeMap = byId(incidentTypes)
      const helpMap = byId(helpOptions)
      const csvRows = incidents.map((incident) => {
        const help = splitHelpOptionIds(incident.help_option_ids)
          .map(id => helpMap.get(id))
          .filter((row): row is JsonRecord => Boolean(row))
        return flattenIncidentForCsv(
          incident,
          locationMap.get(String(incident.location_id ?? '')),
          typeMap.get(String(incident.incident_type_id ?? '')),
          help,
        )
      })

      downloadTextFile(
        exportFilename('csv'),
        incidentsToCsv(csvRows),
        'text/csv;charset=utf-8',
      )
      return incidents.length
    }

    const incidentIds = incidents.map(row => String(row.incident_id ?? '')).filter(Boolean)

    const [updates, statusUpdates, whatsappActions] = await Promise.all([
      fetchInChunks(incidentIds, chunk =>
        fetchPaged(() =>
          supabase
            .from('incident_updates')
            .select('*')
            .in('incident_id', chunk)
            .order('created_at', { ascending: true }) as unknown as PagedQuery,
        ),
      ),
      fetchInChunks(incidentIds, chunk =>
        fetchPaged(() =>
          supabase
            .from('incident_status_updates')
            .select('*')
            .in('incident_id', chunk)
            .order('created_at', { ascending: true }) as unknown as PagedQuery,
        ),
      ),
      fetchInChunks(incidentIds, chunk =>
        fetchPaged(() =>
          supabase
            .from('whatsapp_message_actions')
            .select('*')
            .in('incident_id', chunk) as unknown as PagedQuery,
        ),
      ),
    ])

    const messageIds = whatsappActions
      .map(row => String(row.message_id ?? ''))
      .filter(Boolean)

    const whatsappMessages = await fetchInChunks(messageIds, chunk =>
      fetchPaged(() =>
        supabase
          .from('whatsapp_messages')
          .select('*')
          .in('id', chunk)
          .order('received_at', { ascending: true }) as unknown as PagedQuery,
      ),
    )

    const groupJids = whatsappMessages
      .map(row => String(row.group_jid ?? ''))
      .filter(Boolean)

    const whatsappGroups = await fetchInChunks(groupJids, chunk =>
      fetchPaged(() =>
        supabase
          .from('whatsapp_groups')
          .select('*')
          .in('group_jid', chunk) as unknown as PagedQuery,
      ),
    )

    const payload = buildIncidentExportJson({
      filters,
      matchedIds,
      incidents,
      relatedIncidents: incidentRows,
      locations,
      incidentTypes,
      helpOptions,
      updates,
      statusUpdates,
      whatsappActions,
      whatsappMessages,
      whatsappGroups,
    })

    downloadTextFile(
      exportFilename('json'),
      `${JSON.stringify(payload, null, 2)}\n`,
      'application/json;charset=utf-8',
    )
    return incidents.length
  }

  return {
    listIncidentIndex,
    exportIncidents,
  }
}
