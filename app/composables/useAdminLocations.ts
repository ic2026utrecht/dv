import type { Location } from '~/types/models'

export const LOCATION_ZONES = [
  { value: 'hal', label: 'Hal' },
  { value: 'outdoor', label: 'Openbare ruimte' },
  { value: 'parking', label: 'Parkeren' },
  { value: 'entrance', label: 'Entree' },
  { value: 'assembly', label: 'Verzamelplaats' },
  { value: 'other', label: 'Overig' },
] as const

function mapLocationRow(row: {
  id: string
  name: string
  zone: string | null
  active: boolean | null
}): Location {
  return {
    id: row.id,
    name: row.name,
    zone: row.zone ?? '',
    active: row.active !== false,
  }
}

function slugifyLocationId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug ? `loc-${slug}` : 'loc-new'
}

function uniqueLocationId(baseId: string, existingIds: Set<string>): string {
  if (!existingIds.has(baseId)) {
    return baseId
  }

  let suffix = 2
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1
  }
  return `${baseId}-${suffix}`
}

export function useAdminLocations() {
  const supabase = useSupabaseClient()

  async function listLocations(): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name')

    if (error) throw new Error(error.message)
    return (data ?? []).map(mapLocationRow)
  }

  async function addLocation(payload: {
    name: string
    zone: string
    active?: boolean
  }): Promise<Location> {
    const trimmedName = payload.name.trim()
    if (!trimmedName) {
      throw new Error('Naam is verplicht')
    }

    const existing = await listLocations()
    const existingIds = new Set(existing.map(location => location.id))
    const id = uniqueLocationId(slugifyLocationId(trimmedName), existingIds)

    const { data, error } = await supabase
      .from('locations')
      .insert({
        id,
        name: trimmedName,
        zone: payload.zone,
        active: payload.active !== false,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return mapLocationRow(data)
  }

  async function updateLocation(payload: {
    id: string
    name: string
    zone: string
    active: boolean
  }): Promise<Location> {
    const trimmedName = payload.name.trim()
    if (!trimmedName) {
      throw new Error('Naam is verplicht')
    }

    const { data, error } = await supabase
      .from('locations')
      .update({
        name: trimmedName,
        zone: payload.zone,
        active: payload.active,
      })
      .eq('id', payload.id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return mapLocationRow(data)
  }

  return {
    listLocations,
    addLocation,
    updateLocation,
  }
}
