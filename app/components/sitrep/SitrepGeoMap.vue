<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Incident, RasterMapDefinition } from '~/types/models'
import { JAARBEURS_MAP_CENTER, isGeorefCalibrated } from '~/constants/defaultRasterMap'
import {
  anchorBoundsLatLngs,
  imageCornerLatLngs,
  imageTopEdgeBearing,
  sectorToLatLng,
} from '~/utils/rasterMapProjection'
import { getIncidentSeverity, severityMarkerClass, type SitrepSeverity } from '~/utils/sitrepColors'

;(globalThis as unknown as { L: typeof L }).L = L

const props = defineProps<{
  incidents: Incident[]
  rasterMap: RasterMapDefinition
}>()

const { filterIncidents } = useSitrepQuery()
const { openEditIncident } = useSitrepEditIncident()
const { hoveredIncidentId } = useSitrepMapHighlight()

const MAP_ORIENTATION_KEY = 'sitrep-map-geo-orientation'
type MapOrientation = 'north' | 'raster'

const mapEl = ref<HTMLElement | null>(null)
const mapReady = ref(false)
const pluginReady = ref(false)
const mapOrientation = ref<MapOrientation>('raster')

async function ensureLeafletPlugins() {
  if (pluginReady.value) return
  await import('leaflet-imageoverlay-rotated')
  await import('leaflet-rotate')
  pluginReady.value = true
}

const SEVERITY_RANK: Record<SitrepSeverity, number> = {
  critical: 0,
  high: 1,
  warning: 2,
  ok: 3,
  closed: 4,
}

function getHighestSeverity(severities: SitrepSeverity[]): SitrepSeverity {
  return severities.reduce((highest, current) =>
    SEVERITY_RANK[current] < SEVERITY_RANK[highest] ? current : highest,
  )
}

const geoMarkers = computed(() => {
  const bySector = new Map<string, {
    lat: number
    lng: number
    incidents: Incident[]
    severities: SitrepSeverity[]
  }>()

  for (const incident of filterIncidents(props.incidents)) {
    if (!incident.sector) continue
    const ll = sectorToLatLng(incident.sector, props.rasterMap)
    if (!ll) continue
    const existing = bySector.get(incident.sector)
    const severity = getIncidentSeverity(incident)
    if (existing) {
      existing.incidents.push(incident)
      existing.severities.push(severity)
    }
    else {
      bySector.set(incident.sector, {
        lat: ll.lat,
        lng: ll.lng,
        incidents: [incident],
        severities: [severity],
      })
    }
  }

  return Array.from(bySector.entries()).map(([sector, group]) => ({
    sector,
    lat: group.lat,
    lng: group.lng,
    incidents: group.incidents,
    count: group.incidents.length,
    severity: getHighestSeverity(group.severities),
  }))
})

const incidentCountOnMap = computed(() =>
  geoMarkers.value.reduce((total, m) => total + m.count, 0),
)

const calibrated = computed(() => isGeorefCalibrated(props.rasterMap.geoAnchors))

const rasterBearing = computed(() =>
  imageTopEdgeBearing(props.rasterMap.geoAnchors),
)

function applyMapBearing() {
  if (!map || typeof map.setBearing !== 'function') return
  const bearing = mapOrientation.value === 'raster' && rasterBearing.value != null
    ? rasterBearing.value
    : 0
  map.setBearing(bearing)
}

function fitToAnchors() {
  if (!map) return
  const pts = anchorBoundsLatLngs(props.rasterMap.geoAnchors)
  if (map.getBearing?.() !== 0) {
    map.setBearing(0)
  }

  if (pts?.length) {
    map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng] as [number, number])), {
      padding: [24, 24],
      maxZoom: 18,
    })
  }
  else {
    map.setView([JAARBEURS_MAP_CENTER.lat, JAARBEURS_MAP_CENTER.lng], JAARBEURS_MAP_CENTER.zoom)
  }

  applyMapBearing()
}

function setMapOrientation(orientation: MapOrientation) {
  mapOrientation.value = orientation
  if (import.meta.client) {
    localStorage.setItem(MAP_ORIENTATION_KEY, orientation)
  }
  applyMapBearing()
}

let map: L.Map | null = null
let overlayLayer: L.ImageOverlay | null = null
let mapInitializing = false
const markerLayer = L.layerGroup()
const markerBySector = new Map<string, L.Marker>()

function markerHtml(sector: string, count: number, severity: SitrepSeverity, active: boolean): string {
  const countHtml = count > 1
    ? `<span class="ic-sitrep-marker__count ic-sitrep-marker__count--${severity}">${count}</span>`
    : ''
  return `<button type="button" class="ic-sitrep-marker ${severityMarkerClass(severity)}${active ? ' ic-sitrep-marker--active' : ''}" aria-label="${sector}">
    <span class="ic-sitrep-marker__pulse" aria-hidden="true"></span>
    ${countHtml}
    <span class="ic-sitrep-marker__label">${sector}</span>
  </button>`
}

function syncMarkers() {
  if (!map) return
  const nextSectors = new Set(geoMarkers.value.map(m => m.sector))
  for (const [sector, marker] of markerBySector) {
    if (!nextSectors.has(sector)) {
      markerLayer.removeLayer(marker)
      markerBySector.delete(sector)
    }
  }

  const hoveredId = hoveredIncidentId.value
  const hoveredIncident = hoveredId
    ? filterIncidents(props.incidents).find(i => i.incidentId === hoveredId)
    : null

  for (const group of geoMarkers.value) {
    const active = hoveredIncident?.sector === group.sector
    const html = markerHtml(group.sector, group.count, group.severity, active)
    const icon = L.divIcon({
      className: 'ic-sitrep-geo-marker',
      html,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })
    let marker = markerBySector.get(group.sector)
    if (!marker) {
      marker = L.marker([group.lat, group.lng], { icon, riseOnHover: true })
      marker.on('click', () => {
        if (group.count === 1) {
          openEditIncident(group.incidents[0]!)
        }
        else {
          openEditIncident(group.incidents[0]!)
        }
      })
      marker.bindTooltip(
        group.count > 1
          ? `${group.count} incidenten · ${group.sector}`
          : `${group.incidents[0]!.incidentId} · ${group.sector}`,
        { direction: 'top', offset: [0, -12] },
      )
      markerLayer.addLayer(marker)
      markerBySector.set(group.sector, marker)
    }
    else {
      marker.setLatLng([group.lat, group.lng])
      marker.setIcon(icon)
    }
  }
}

async function syncOverlay() {
  if (!map || !calibrated.value) return
  await ensureLeafletPlugins()
  const corners = imageCornerLatLngs(props.rasterMap.geoAnchors)
  if (!corners) return

  if (overlayLayer) {
    map.removeLayer(overlayLayer)
    overlayLayer = null
  }

  const rotated = (L.imageOverlay as unknown as {
    rotated: (
      url: string,
      tl: L.LatLngExpression,
      tr: L.LatLngExpression,
      bl: L.LatLngExpression,
      options?: L.ImageOverlayOptions,
    ) => L.ImageOverlay
  }).rotated(
    props.rasterMap.imageUrl,
    [corners.topLeft.lat, corners.topLeft.lng],
    [corners.topRight.lat, corners.topRight.lng],
    [corners.bottomLeft.lat, corners.bottomLeft.lng],
    { opacity: 0.7, interactive: false },
  )
  overlayLayer = rotated
  rotated.addTo(map)
}

async function initMap() {
  if (!mapEl.value || map || mapInitializing) return
  mapInitializing = true
  try {
    await ensureLeafletPlugins()

    map = L.map(mapEl.value, {
      zoomControl: true,
      attributionControl: true,
      rotate: true,
      rotateControl: false,
      touchRotate: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    markerLayer.addTo(map)
    await syncOverlay()
    syncMarkers()
    fitToAnchors()
    mapReady.value = true

    requestAnimationFrame(() => {
      map?.invalidateSize()
      applyMapBearing()
    })
  }
  finally {
    mapInitializing = false
  }
}

onMounted(() => {
  if (import.meta.client) {
    const stored = localStorage.getItem(MAP_ORIENTATION_KEY)
    if (stored === 'north' || stored === 'raster') {
      mapOrientation.value = stored
    }
  }
  nextTick(() => {
    void initMap()
  })
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
  overlayLayer = null
  markerBySector.clear()
})

watch(
  () => [props.rasterMap.imageUrl, props.rasterMap.geoAnchors, calibrated.value] as const,
  () => {
    void syncOverlay()
    fitToAnchors()
  },
  { deep: true },
)

watch(geoMarkers, () => syncMarkers(), { deep: true })
watch(hoveredIncidentId, () => syncMarkers())

watch(mapEl, (el) => {
  if (el && !map) {
    nextTick(() => {
      void initMap()
    })
  }
})

const incidentCountExposed = computed(() => incidentCountOnMap.value)

defineExpose({
  incidentCountOnMap: incidentCountExposed,
  invalidateSize: () => map?.invalidateSize(),
})
</script>

<template>
  <div class="ic-sitrep-geo">
    <p
      v-if="!calibrated"
      class="ic-sitrep-geo__banner"
      role="status"
    >
      Geo-ankers incompleet — stel hoeken in via Admin → Kaarten.
    </p>
    <div
      v-if="mapReady && calibrated"
      class="ic-sitrep-geo__orient"
      role="group"
      aria-label="Kaartoriëntatie"
    >
      <button
        type="button"
        class="ic-sitrep-geo__orient-btn"
        :class="{ 'ic-sitrep-geo__orient-btn--active': mapOrientation === 'north' }"
        title="Noord boven"
        @click="setMapOrientation('north')"
      >
        Noord
      </button>
      <button
        type="button"
        class="ic-sitrep-geo__orient-btn"
        :class="{ 'ic-sitrep-geo__orient-btn--active': mapOrientation === 'raster' }"
        title="Zelfde orientatie als rasterkaart"
        @click="setMapOrientation('raster')"
      >
        Raster
      </button>
    </div>
    <div
      ref="mapEl"
      class="ic-sitrep-geo__map"
      role="application"
      aria-label="OpenStreetMap sitrep"
    />
  </div>
</template>

<style scoped>
.ic-sitrep-geo {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.ic-sitrep-geo__banner {
  position: absolute;
  z-index: 500;
  top: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  max-width: min(28rem, calc(100% - 1rem));
  margin: 0;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  background: rgb(28 29 82 / 0.92);
  color: #fff;
  font-size: 0.75rem;
  text-align: center;
  pointer-events: none;
}

.ic-sitrep-geo__orient {
  position: absolute;
  z-index: 1000;
  top: 0.5rem;
  right: 0.5rem;
  display: inline-flex;
  border: 1px solid rgb(135 161 198 / 0.55);
  border-radius: 0.375rem;
  overflow: hidden;
  background: rgb(255 255 255 / 0.96);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.12);
}

.ic-sitrep-geo__orient-btn {
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--ic-brand, #1c1d52);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
}

.ic-sitrep-geo__orient-btn--active {
  background: var(--ic-brand, #1c1d52);
  color: #fff;
}

.ic-sitrep-geo__orient-btn:not(.ic-sitrep-geo__orient-btn--active):hover {
  background: rgb(135 161 198 / 0.12);
}

.ic-sitrep-geo__map {
  width: 100%;
  height: 100%;
  min-height: 12rem;
  background: #e2e8f0;
}

.ic-sitrep-geo :deep(.ic-sitrep-geo-marker) {
  background: transparent;
  border: none;
}

.ic-sitrep-geo :deep(.ic-sitrep-marker) {
  position: relative;
  transform: none;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 9999px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
}

.ic-sitrep-geo :deep(.ic-sitrep-marker__pulse) {
  position: absolute;
  inset: -4px;
  border-radius: 9999px;
  animation: ic-pulse 2s ease-out infinite;
}

.ic-sitrep-geo :deep(.ic-sitrep-marker--critical) {
  background: var(--ic-critical);
}
.ic-sitrep-geo :deep(.ic-sitrep-marker--critical .ic-sitrep-marker__pulse) {
  background: rgb(153 27 27 / 0.35);
}
.ic-sitrep-geo :deep(.ic-sitrep-marker--high) {
  background: var(--ic-high);
}
.ic-sitrep-geo :deep(.ic-sitrep-marker--high .ic-sitrep-marker__pulse) {
  background: rgb(239 68 68 / 0.35);
}
.ic-sitrep-geo :deep(.ic-sitrep-marker--warning) {
  background: var(--ic-orange);
}
.ic-sitrep-geo :deep(.ic-sitrep-marker--warning .ic-sitrep-marker__pulse) {
  background: rgb(230 151 50 / 0.35);
}
.ic-sitrep-geo :deep(.ic-sitrep-marker--ok) {
  background: #22c55e;
}
.ic-sitrep-geo :deep(.ic-sitrep-marker--ok .ic-sitrep-marker__pulse) {
  background: rgb(34 197 94 / 0.35);
}
.ic-sitrep-geo :deep(.ic-sitrep-marker--closed) {
  background: #94a3b8;
}
.ic-sitrep-geo :deep(.ic-sitrep-marker--closed .ic-sitrep-marker__pulse) {
  display: none;
}

.ic-sitrep-geo :deep(.ic-sitrep-marker__count) {
  position: absolute;
  top: -0.3125rem;
  right: -0.3125rem;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0.875rem;
  height: 0.875rem;
  padding: 0 0.125rem;
  border: 1.5px solid #fff;
  border-radius: 9999px;
  font-size: 0.5rem;
  font-weight: 700;
  color: #fff;
}
.ic-sitrep-geo :deep(.ic-sitrep-marker__count--critical) { background: var(--ic-critical); }
.ic-sitrep-geo :deep(.ic-sitrep-marker__count--high) { background: var(--ic-high); }
.ic-sitrep-geo :deep(.ic-sitrep-marker__count--warning) { background: var(--ic-orange); }
.ic-sitrep-geo :deep(.ic-sitrep-marker__count--ok) { background: #22c55e; }
.ic-sitrep-geo :deep(.ic-sitrep-marker__count--closed) { background: #94a3b8; }

.ic-sitrep-geo :deep(.ic-sitrep-marker__label) {
  position: absolute;
  top: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.5625rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.8);
  white-space: nowrap;
  pointer-events: none;
}

@keyframes ic-pulse {
  0% { transform: scale(1); opacity: 0.7; }
  70% { transform: scale(1.8); opacity: 0; }
  100% { transform: scale(1.8); opacity: 0; }
}
</style>
