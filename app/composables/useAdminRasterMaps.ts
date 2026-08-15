import type { RasterGeoAnchor, RasterGeoAnchorKey, RasterMapDefinition, RasterMapGridBounds } from '~/types/models'
import { BUNDLED_RASTER_ASSET_PATH } from '~/constants/defaultRasterMap'
import { getSectorImageFraction } from '~/constants/rasterMapGrid'
import { mapRasterMapRow, type RasterMapRow } from '~/utils/rasterMapApi'
import { RASTER_COLUMNS, RASTER_ROWS } from '~/utils/incidentOptions'

function slugifyMapId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'map'
}

function uniqueMapId(baseId: string, existing: Set<string>): string {
  if (!existing.has(baseId)) {
    return baseId
  }
  let n = 2
  while (existing.has(`${baseId}-${n}`)) {
    n += 1
  }
  return `${baseId}-${n}`
}

export function recomputeAnchorFractions(
  anchors: Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>>,
  gridBounds: RasterMapGridBounds,
  rows: string[] = RASTER_ROWS,
  columns: number[] = RASTER_COLUMNS,
): Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>> {
  const next: Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>> = {}
  for (const key of ['nw', 'ne', 'sw', 'se'] as const) {
    const a = anchors[key]
    if (!a) {
      continue
    }
    const frac = getSectorImageFraction(a.sector, a.corner, rows, columns, gridBounds)
    next[key] = frac
      ? { ...a, fx: frac.fx, fy: frac.fy }
      : { ...a }
  }
  return next
}

export function useAdminRasterMaps() {
  const supabase = useSupabaseClient()

  async function listMaps(): Promise<RasterMapDefinition[]> {
    const { data, error } = await supabase
      .from('raster_maps')
      .select('*')
      .order('sort_order')
      .order('name')

    if (error) throw new Error(error.message)
    return (data ?? []).map(row => mapRasterMapRow(row as RasterMapRow, supabase))
  }

  async function getMap(id: string): Promise<RasterMapDefinition | null> {
    const { data, error } = await supabase
      .from('raster_maps')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    return mapRasterMapRow(data as RasterMapRow, supabase)
  }

  async function addMap(payload: {
    name: string
    imagePath?: string
    gridBounds: RasterMapGridBounds
    rows?: string[]
    columns?: number[]
    geoAnchors?: Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>>
    active?: boolean
    isDefault?: boolean
  }): Promise<RasterMapDefinition> {
    const name = payload.name.trim()
    if (!name) throw new Error('Naam is verplicht')

    const existing = await listMaps()
    const id = uniqueMapId(slugifyMapId(name), new Set(existing.map(m => m.id)))

    if (payload.isDefault) {
      await supabase.from('raster_maps').update({ is_default: false }).eq('is_default', true)
    }

    const row = {
      id,
      name,
      image_path: payload.imagePath || BUNDLED_RASTER_ASSET_PATH,
      active: payload.active !== false,
      is_default: payload.isDefault === true || existing.length === 0,
      grid_bounds: payload.gridBounds,
      rows: payload.rows ?? [...RASTER_ROWS],
      columns: payload.columns ?? [...RASTER_COLUMNS],
      geo_anchors: payload.geoAnchors ?? {},
      sort_order: existing.length,
    }

    const { data, error } = await supabase.from('raster_maps').insert(row).select('*').single()
    if (error) throw new Error(error.message)
    return mapRasterMapRow(data as RasterMapRow, supabase)
  }

  async function updateMap(
    id: string,
    patch: {
      name?: string
      imagePath?: string
      active?: boolean
      isDefault?: boolean
      gridBounds?: RasterMapGridBounds
      rows?: string[]
      columns?: number[]
      geoAnchors?: Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>>
      sortOrder?: number
      recomputeAnchorFxFy?: boolean
    },
  ): Promise<RasterMapDefinition> {
    const current = await getMap(id)
    if (!current) throw new Error('Kaart niet gevonden')

    if (patch.isDefault === true) {
      await supabase.from('raster_maps').update({ is_default: false }).neq('id', id).eq('is_default', true)
    }

    const gridBounds = patch.gridBounds ?? current.gridBounds
    const rows = patch.rows ?? current.rows
    const columns = patch.columns ?? current.columns
    let geoAnchors = patch.geoAnchors ?? current.geoAnchors

    if (patch.recomputeAnchorFxFy || patch.gridBounds) {
      geoAnchors = recomputeAnchorFractions(geoAnchors, gridBounds, rows, columns)
    }

    const payload: Record<string, unknown> = {}
    if (patch.name != null) payload.name = patch.name.trim()
    if (patch.imagePath != null) payload.image_path = patch.imagePath
    if (patch.active != null) payload.active = patch.active
    if (patch.isDefault != null) payload.is_default = patch.isDefault
    if (patch.gridBounds != null) payload.grid_bounds = gridBounds
    if (patch.rows != null) payload.rows = rows
    if (patch.columns != null) payload.columns = columns
    if (patch.sortOrder != null) payload.sort_order = patch.sortOrder
    if (
      patch.geoAnchors != null
      || patch.recomputeAnchorFxFy
      || patch.gridBounds != null
    ) {
      payload.geo_anchors = geoAnchors
    }
    if (patch.gridBounds != null) {
      payload.grid_bounds = gridBounds
    }

    const { data, error } = await supabase
      .from('raster_maps')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return mapRasterMapRow(data as RasterMapRow, supabase)
  }

  async function setDefault(id: string): Promise<void> {
    await updateMap(id, { isDefault: true, active: true })
  }

  async function deleteMap(id: string): Promise<void> {
    const maps = await listMaps()
    const target = maps.find(m => m.id === id)
    if (!target) return
    if (target.isDefault) {
      throw new Error('Stel eerst een andere kaart als standaard in')
    }
    const { error } = await supabase.from('raster_maps').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async function uploadImage(file: File, mapId: string): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${mapId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('raster-maps').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/png',
    })
    if (error) throw new Error(error.message)
    return path
  }

  return {
    listMaps,
    getMap,
    addMap,
    updateMap,
    setDefault,
    deleteMap,
    uploadImage,
  }
}
