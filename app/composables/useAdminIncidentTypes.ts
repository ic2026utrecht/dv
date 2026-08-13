import type { Department } from '~/types/models'
import { DEPARTMENTS } from '~/constants/incident'

export interface AdminIncidentType {
  id: string
  department: Department
  name: string
  active: boolean
}

export const DEPARTMENT_OPTIONS = DEPARTMENTS.map(d => ({ value: d, label: d }))

function mapIncidentTypeRow(row: {
  id: string
  department: string
  name: string
  active: boolean | null
}): AdminIncidentType {
  return {
    id: row.id,
    department: row.department as Department,
    name: row.name,
    active: row.active !== false,
  }
}

function slugifyIncidentTypeId(department: string, name: string): string {
  const slug = `${department}-${name}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'incident-type-new'
}

function uniqueIncidentTypeId(baseId: string, existingIds: Set<string>): string {
  if (!existingIds.has(baseId)) {
    return baseId
  }

  let suffix = 2
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1
  }
  return `${baseId}-${suffix}`
}

export function useAdminIncidentTypes() {
  const supabase = useSupabaseClient()

  async function listIncidentTypes(): Promise<AdminIncidentType[]> {
    const { data, error } = await supabase
      .from('incident_types')
      .select('*')
      .order('department')
      .order('name')

    if (error) throw new Error(error.message)
    return (data ?? []).map(mapIncidentTypeRow)
  }

  async function addIncidentType(payload: {
    name: string
    department: Department
    active?: boolean
  }): Promise<AdminIncidentType> {
    const trimmedName = payload.name.trim()
    if (!trimmedName) {
      throw new Error('Naam is verplicht')
    }

    const existing = await listIncidentTypes()
    const existingIds = new Set(existing.map(type => type.id))
    const id = uniqueIncidentTypeId(
      slugifyIncidentTypeId(payload.department, trimmedName),
      existingIds,
    )

    const { data, error } = await supabase
      .from('incident_types')
      .insert({
        id,
        name: trimmedName,
        department: payload.department,
        active: payload.active !== false,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return mapIncidentTypeRow(data)
  }

  async function updateIncidentType(payload: {
    id: string
    name: string
    department: Department
    active: boolean
  }): Promise<AdminIncidentType> {
    const trimmedName = payload.name.trim()
    if (!trimmedName) {
      throw new Error('Naam is verplicht')
    }

    const { data, error } = await supabase
      .from('incident_types')
      .update({
        name: trimmedName,
        department: payload.department,
        active: payload.active,
      })
      .eq('id', payload.id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return mapIncidentTypeRow(data)
  }

  return {
    listIncidentTypes,
    addIncidentType,
    updateIncidentType,
  }
}
