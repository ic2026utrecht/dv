import type {
  RasterGeoAnchor,
  RasterGeoAnchorKey,
  RasterMapDefinition,
} from '~/types/models'
import { isGeorefCalibrated } from '~/constants/defaultRasterMap'
import { getSectorMarkerPosition } from '~/constants/rasterMapGrid'

export interface LatLng {
  lat: number
  lng: number
}

type FullAnchors = Record<RasterGeoAnchorKey, RasterGeoAnchor>

function asFullAnchors(
  anchors: Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>>,
): FullAnchors | null {
  if (!isGeorefCalibrated(anchors)) {
    return null
  }
  return anchors as FullAnchors
}

/**
 * Bilinear map from image fractions (0–1) to WGS84 using the four geo anchors.
 * Anchors may sit inside the image (e.g. B2/J21); values outside the quad are extrapolated.
 */
export function imageFractionToLatLng(
  fx: number,
  fy: number,
  anchors: Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>>,
): LatLng | null {
  const a = asFullAnchors(anchors)
  if (!a) {
    return null
  }

  const { nw, ne, sw, se } = a
  const du = ne.fx - nw.fx
  const dv = sw.fy - nw.fy
  if (Math.abs(du) < 1e-12 || Math.abs(dv) < 1e-12) {
    return null
  }

  const u = (fx - nw.fx) / du
  const v = (fy - nw.fy) / dv
  const w00 = (1 - u) * (1 - v)
  const w10 = u * (1 - v)
  const w01 = (1 - u) * v
  const w11 = u * v

  return {
    lat: w00 * nw.lat + w10 * ne.lat + w01 * sw.lat + w11 * se.lat,
    lng: w00 * nw.lng + w10 * ne.lng + w01 * sw.lng + w11 * se.lng,
  }
}

/** Cell-center lat/lng for a sector code (e.g. F11). */
export function sectorToLatLng(
  sectorCode: string,
  map: Pick<RasterMapDefinition, 'gridBounds' | 'rows' | 'columns' | 'geoAnchors'>,
): LatLng | null {
  const position = getSectorMarkerPosition(sectorCode, map.rows, map.columns, map.gridBounds)
  if (!position) {
    return null
  }
  const fx = Number.parseFloat(position.left) / 100
  const fy = Number.parseFloat(position.top) / 100
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) {
    return null
  }
  return imageFractionToLatLng(fx, fy, map.geoAnchors)
}

/** PNG corners for leaflet-imageoverlay-rotated (image TL / TR / BL). */
export function imageCornerLatLngs(
  anchors: Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>>,
): { topLeft: LatLng, topRight: LatLng, bottomLeft: LatLng } | null {
  const topLeft = imageFractionToLatLng(0, 0, anchors)
  const topRight = imageFractionToLatLng(1, 0, anchors)
  const bottomLeft = imageFractionToLatLng(0, 1, anchors)
  if (!topLeft || !topRight || !bottomLeft) {
    return null
  }
  return { topLeft, topRight, bottomLeft }
}

/** Geographic bearing in degrees (0 = north, clockwise) from one point to another. */
export function bearingBetween(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180
  const φ2 = (to.lat * Math.PI) / 180
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = (Math.atan2(y, x) * 180) / Math.PI
  return (θ + 360) % 360
}

/** Clockwise map bearing so the image top edge runs left-to-right on screen. */
export function imageTopEdgeBearing(
  anchors: Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>>,
): number | null {
  const corners = imageCornerLatLngs(anchors)
  if (!corners) {
    return null
  }
  return bearingBetween(corners.topLeft, corners.topRight)
}

export function anchorBoundsLatLngs(
  anchors: Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>>,
): LatLng[] | null {
  const a = asFullAnchors(anchors)
  if (!a) {
    return null
  }
  return [
    { lat: a.nw.lat, lng: a.nw.lng },
    { lat: a.ne.lat, lng: a.ne.lng },
    { lat: a.se.lat, lng: a.se.lng },
    { lat: a.sw.lat, lng: a.sw.lng },
  ]
}
