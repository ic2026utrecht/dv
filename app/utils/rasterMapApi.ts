import type { SupabaseClient } from '@supabase/supabase-js'
import type { RasterMapDefinition } from '~/types/models'
import {
  BUNDLED_RASTER_ASSET_PATH,
  createDefaultRasterMapDefinition,
  parseGeoAnchors,
  parseGridBounds,
} from '~/constants/defaultRasterMap'
import { RASTER_COLUMNS, RASTER_ROWS } from '~/utils/incidentOptions'
import bundledRasterMapUrl from '~/assets/images/raster-map.png'

export interface RasterMapRow {
  id: string
  name: string
  image_path: string
  active: boolean | null
  is_default: boolean | null
  grid_bounds: unknown
  rows: unknown
  columns: unknown
  geo_anchors: unknown
  sort_order: number | null
  updated_at?: string | null
}

export function resolveRasterMapImageUrl(
  client: SupabaseClient,
  imagePath: string,
): string {
  if (!imagePath || imagePath === BUNDLED_RASTER_ASSET_PATH || imagePath.startsWith('asset:')) {
    return bundledRasterMapUrl
  }
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
    return imagePath
  }
  const { data } = client.storage.from('raster-maps').getPublicUrl(imagePath)
  return data.publicUrl || bundledRasterMapUrl
}

export function mapRasterMapRow(
  row: RasterMapRow,
  client: SupabaseClient,
): RasterMapDefinition {
  const rows = Array.isArray(row.rows)
    ? row.rows.map(String)
    : [...RASTER_ROWS]
  const columns = Array.isArray(row.columns)
    ? row.columns.map(Number).filter(Number.isFinite)
    : [...RASTER_COLUMNS]

  return {
    id: row.id,
    name: row.name,
    imagePath: row.image_path,
    imageUrl: resolveRasterMapImageUrl(client, row.image_path),
    active: row.active !== false,
    isDefault: row.is_default === true,
    gridBounds: parseGridBounds(row.grid_bounds),
    rows: rows.length ? rows : [...RASTER_ROWS],
    columns: columns.length ? columns : [...RASTER_COLUMNS],
    geoAnchors: parseGeoAnchors(row.geo_anchors),
    sortOrder: row.sort_order ?? 0,
    updatedAt: row.updated_at ?? undefined,
  }
}

export async function fetchDefaultRasterMap(
  client: SupabaseClient,
): Promise<RasterMapDefinition> {
  const { data, error } = await client
    .from('raster_maps')
    .select('*')
    .eq('active', true)
    .eq('is_default', true)
    .maybeSingle()

  if (!error && data) {
    return mapRasterMapRow(data as RasterMapRow, client)
  }

  const { data: fallback, error: fallbackError } = await client
    .from('raster_maps')
    .select('*')
    .eq('active', true)
    .order('sort_order')
    .order('name')
    .limit(1)
    .maybeSingle()

  if (!fallbackError && fallback) {
    return mapRasterMapRow(fallback as RasterMapRow, client)
  }

  return createDefaultRasterMapDefinition(bundledRasterMapUrl)
}
