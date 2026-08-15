import type {
  RasterGeoAnchor,
  RasterGeoAnchorKey,
  RasterMapDefinition,
  RasterMapGridBounds,
} from '~/types/models'
import { RASTER_MAP_GRID_BOUNDS } from '~/constants/rasterMapGrid'
import { RASTER_COLUMNS, RASTER_ROWS } from '~/utils/incidentOptions'

/** Bundled PDF raster — used when DB has no default map. */
export const DEFAULT_RASTER_MAP_ID = 'jaarbeurs-2026'

export const DEFAULT_RASTER_MAP_GEO_ANCHORS: Record<RasterGeoAnchorKey, RasterGeoAnchor> = {
  nw: {
    sector: 'B2',
    corner: 'top-left',
    fx: 0.08357377485795454,
    fy: 0.1453600561354267,
    lat: 52.08237490299695,
    lng: 5.105138437525606,
  },
  ne: {
    sector: 'B21',
    corner: 'top-right',
    fx: 0.8761430220170454,
    fy: 0.1453600561354267,
    lat: 52.08512716822191,
    lng: 5.099417806258384,
  },
  sw: {
    sector: 'J2',
    corner: 'bottom-left',
    fx: 0.08357377485795454,
    fy: 0.6505788965880187,
    lat: 52.083853912190285,
    lng: 5.107127765769181,
  },
  se: {
    sector: 'J21',
    corner: 'bottom-right',
    fx: 0.8761430220170454,
    fy: 0.6505788965880187,
    lat: 52.08761937294106,
    lng: 5.103798566900812,
  },
}

export const JAARBEURS_MAP_CENTER = {
  lat: 52.08474,
  lng: 5.10387,
  zoom: 17,
} as const

/** Marker for bundled asset in image_path column. */
export const BUNDLED_RASTER_ASSET_PATH = 'asset:raster-map.png'

export function createDefaultRasterMapDefinition(imageUrl: string): RasterMapDefinition {
  return {
    id: DEFAULT_RASTER_MAP_ID,
    name: 'Jaarbeurs Utrecht 2026',
    imageUrl,
    imagePath: BUNDLED_RASTER_ASSET_PATH,
    active: true,
    isDefault: true,
    gridBounds: { ...RASTER_MAP_GRID_BOUNDS },
    rows: [...RASTER_ROWS],
    columns: [...RASTER_COLUMNS],
    geoAnchors: { ...DEFAULT_RASTER_MAP_GEO_ANCHORS },
    sortOrder: 0,
  }
}

export function isGeorefCalibrated(
  anchors: Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>> | null | undefined,
): boolean {
  if (!anchors) {
    return false
  }
  return (['nw', 'ne', 'sw', 'se'] as const).every((key) => {
    const a = anchors[key]
    return a != null
      && Number.isFinite(a.lat)
      && Number.isFinite(a.lng)
      && Number.isFinite(a.fx)
      && Number.isFinite(a.fy)
  })
}

export function parseGridBounds(raw: unknown, fallback: RasterMapGridBounds = RASTER_MAP_GRID_BOUNDS): RasterMapGridBounds {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback }
  }
  const o = raw as Record<string, unknown>
  const left = Number(o.left)
  const top = Number(o.top)
  const right = Number(o.right)
  const bottom = Number(o.bottom)
  if (![left, top, right, bottom].every(Number.isFinite)) {
    return { ...fallback }
  }
  return { left, top, right, bottom }
}

export function parseGeoAnchors(raw: unknown): Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>> {
  if (!raw || typeof raw !== 'object') {
    return {}
  }
  const out: Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>> = {}
  for (const key of ['nw', 'ne', 'sw', 'se'] as const) {
    const a = (raw as Record<string, unknown>)[key]
    if (!a || typeof a !== 'object') {
      continue
    }
    const o = a as Record<string, unknown>
    const lat = Number(o.lat)
    const lng = Number(o.lng)
    const fx = Number(o.fx)
    const fy = Number(o.fy)
    if (![lat, lng, fx, fy].every(Number.isFinite)) {
      continue
    }
    const corner = String(o.corner || 'top-left') as RasterGeoAnchor['corner']
    out[key] = {
      sector: String(o.sector || ''),
      corner: ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(corner)
        ? corner
        : 'top-left',
      fx,
      fy,
      lat,
      lng,
    }
  }
  return out
}
