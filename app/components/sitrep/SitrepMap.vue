<script setup lang="ts">
import rasterMap from '~/assets/images/raster-map.png'
import { buildRasterMapCells, getSectorMarkerPosition } from '~/constants/rasterMapGrid'
import type { Incident } from '~/types/models'
import { getIncidentSeverity, severityDotClass, severityMarkerClass, type SitrepSeverity } from '~/utils/sitrepColors'
import {
  drawIncidentHeatmap,
  getHeatmapTiers,
  heatmapTierLabel,
  heatmapTierLegendColor,
  HEATMAP_DEFAULT_TOP_THRESHOLD,
  HEATMAP_TOP_THRESHOLD_MAX,
  HEATMAP_TOP_THRESHOLD_MIN,
  parseMapPercent,
  type HeatmapPoint,
} from '~/utils/sitrepHeatmap'

const props = defineProps<{
  incidents: Incident[]
}>()

const { filterIncidents } = useSitrepQuery()
const { openEditIncident } = useSitrepEditIncident()
const { hoveredIncidentId } = useSitrepMapHighlight()
const hoveredSector = ref<string | null>(null)
const activePickerSector = ref<string | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const heatmapCanvasRef = ref<HTMLCanvasElement | null>(null)
const sectionRef = ref<HTMLElement | null>(null)
const markerEls = new Map<string, HTMLElement>()
const showHeatmap = ref(false)
const heatmapTopThreshold = ref(HEATMAP_DEFAULT_TOP_THRESHOLD)
const heatmapPopoverRef = ref<{ hide: () => void, show: (event: Event) => void, toggle: (event: Event) => void } | null>(null)

const pinchZoom = usePinchZoom({ maxScale: 2.5 })
const {
  scale,
  transformStyle,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
} = pinchZoom

const { fitScale, contentSize, resetMapView, stageSizeStyle } = useSitrepMapFit(viewportRef, imageRef, pinchZoom)

const markerLayerStyle = computed(() => ({
  '--map-scale': scale.value,
}))

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

const markers = computed(() => {
  const bySector = new Map<string, {
    position: { left: string, top: string }
    incidents: Incident[]
    severities: SitrepSeverity[]
  }>()

  for (const incident of filterIncidents(props.incidents)) {
    if (!incident.sector) {
      continue
    }

    const position = getSectorMarkerPosition(incident.sector)
    if (!position) {
      continue
    }

    const existing = bySector.get(incident.sector)
    const severity = getIncidentSeverity(incident)

    if (existing) {
      existing.incidents.push(incident)
      existing.severities.push(severity)
    }
    else {
      bySector.set(incident.sector, {
        position,
        incidents: [incident],
        severities: [severity],
      })
    }
  }

  return Array.from(bySector.entries()).map(([sector, group]) => {
    const highlightedIncident = listHoveredIncident.value?.sector === sector
      ? listHoveredIncident.value
      : null

    return {
      sector,
      position: group.position,
      incidents: group.incidents,
      count: group.incidents.length,
      severity: getHighestSeverity(group.severities),
      highlightedIncident,
    }
  })
})

const incidentCountOnMap = computed(() =>
  markers.value.reduce((total, marker) => total + marker.count, 0),
)

const heatmapPoints = computed<HeatmapPoint[]>(() => {
  const countsBySector = new Map(markers.value.map(marker => [marker.sector, marker.count]))

  return buildRasterMapCells().flatMap((cell) => {
    const position = getSectorMarkerPosition(cell.code)
    if (!position) {
      return []
    }

    return [{
      x: parseMapPercent(position.left),
      y: parseMapPercent(position.top),
      weight: countsBySector.get(cell.code) ?? 0,
    }]
  })
})

const heatmapTiers = computed(() => getHeatmapTiers(heatmapTopThreshold.value))

function syncHeatmapCanvasSize() {
  const canvas = heatmapCanvasRef.value
  const size = contentSize.value
  if (!canvas || !size) {
    return false
  }

  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width
    canvas.height = size.height
  }

  return true
}

function renderHeatmap() {
  if (!import.meta.client || !showHeatmap.value) {
    return
  }

  const canvas = heatmapCanvasRef.value
  if (!canvas || !syncHeatmapCanvasSize()) {
    return
  }

  drawIncidentHeatmap(canvas, heatmapPoints.value, heatmapTopThreshold.value)
}

function clearHeatmap() {
  const canvas = heatmapCanvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) {
    return
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

watch(showHeatmap, (visible) => {
  if (visible) {
    nextTick(renderHeatmap)
    return
  }
  clearHeatmap()
  heatmapPopoverRef.value?.hide()
})

function onHeatmapClick(event: Event) {
  if (!showHeatmap.value) {
    showHeatmap.value = true
    nextTick(() => heatmapPopoverRef.value?.show(event))
    return
  }
  heatmapPopoverRef.value?.toggle(event)
}

function disableHeatmap() {
  showHeatmap.value = false
}

watch([heatmapPoints, contentSize, heatmapTopThreshold], () => {
  if (showHeatmap.value) {
    nextTick(renderHeatmap)
  }
})

const listHoveredIncident = computed(() => {
  const id = hoveredIncidentId.value
  if (!id) {
    return null
  }
  return filterIncidents(props.incidents).find(incident => incident.incidentId === id) ?? null
})

type OverlayPlacement = 'above' | 'below'

const overlayPlacement = ref<OverlayPlacement>('above')
const overlayStyle = ref<{ left: string, top: string } | null>(null)

function setMarkerRef(sector: string, el: Element | { $el?: Element } | null) {
  const node = el instanceof HTMLElement ? el : null
  if (node) {
    markerEls.set(sector, node)
  }
  else {
    markerEls.delete(sector)
  }
}

const overlaySector = computed(() => {
  if (activePickerSector.value) {
    return activePickerSector.value
  }
  if (hoveredSector.value) {
    return hoveredSector.value
  }
  return listHoveredIncident.value?.sector ?? null
})

const overlayMarker = computed(() => {
  const sector = overlaySector.value
  if (!sector) {
    return null
  }
  return markers.value.find(marker => marker.sector === sector) ?? null
})

const overlayMode = computed<'picker' | 'hover' | 'highlight' | null>(() => {
  const sector = overlaySector.value
  if (!sector || !overlayMarker.value) {
    return null
  }
  if (activePickerSector.value === sector) {
    return 'picker'
  }
  if (hoveredSector.value === sector) {
    return 'hover'
  }
  if (listHoveredIncident.value?.sector === sector) {
    return 'highlight'
  }
  return null
})

const overlayIncident = computed(() => {
  if (!overlayMarker.value) {
    return null
  }
  if (overlayMode.value === 'highlight' && overlayMarker.value.highlightedIncident) {
    return overlayMarker.value.highlightedIncident
  }
  return overlayMarker.value.incidents[0] ?? null
})

function updateOverlayPosition() {
  const sector = overlaySector.value
  const section = sectionRef.value
  if (!sector || !section) {
    overlayStyle.value = null
    return
  }

  const marker = markerEls.get(sector)
  if (!marker) {
    overlayStyle.value = null
    return
  }

  const sectionRect = section.getBoundingClientRect()
  const markerRect = marker.getBoundingClientRect()
  const centerX = markerRect.left + markerRect.width / 2 - sectionRect.left
  const markerTop = markerRect.top - sectionRect.top
  const markerBottom = markerRect.bottom - sectionRect.top
  const preferAbove = markerTop >= sectionRect.height - markerBottom

  overlayPlacement.value = preferAbove ? 'above' : 'below'
  overlayStyle.value = {
    left: `${centerX}px`,
    top: preferAbove ? `${markerTop}px` : `${markerBottom}px`,
  }
}

let overlayPositionFrame = 0

function scheduleOverlayPositionUpdate() {
  if (!import.meta.client) {
    return
  }
  cancelAnimationFrame(overlayPositionFrame)
  overlayPositionFrame = requestAnimationFrame(() => {
    updateOverlayPosition()
  })
}

watch([overlaySector, scale, transformStyle, hoveredIncidentId], () => {
  scheduleOverlayPositionUpdate()
}, { deep: true })

watch(viewportRef, (viewport, _, onCleanup) => {
  if (!import.meta.client || !viewport) {
    return
  }

  const observer = new ResizeObserver(() => {
    scheduleOverlayPositionUpdate()
  })
  observer.observe(viewport)
  onCleanup(() => observer.disconnect())
})

onMounted(() => {
  scheduleOverlayPositionUpdate()
})

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return timestamp
  }
  return date.toLocaleString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function onViewportClick() {
  activePickerSector.value = null
}

function onMarkerClick(sector: string, incidents: Incident[], count: number) {
  if (count === 1) {
    activePickerSector.value = null
    openEditIncident(incidents[0]!)
    return
  }

  activePickerSector.value = activePickerSector.value === sector ? null : sector
  scheduleOverlayPositionUpdate()
}

function onPickerSelect(incident: Incident) {
  activePickerSector.value = null
  openEditIncident(incident)
}
</script>

<template>
  <section ref="sectionRef" class="ic-sitrep-map ic-sitrep-map--panel">
    <header class="ic-sitrep-map__header">
      <div class="ic-sitrep-map__header-main">

      </div>
      <div class="ic-sitrep-map__header-actions">
        <button
          v-if="scale > fitScale + 0.01"
          type="button"
          class="ic-sitrep-map__reset"
          @click="resetMapView"
        >
          <i class="pi pi-refresh" aria-hidden="true" />
          Reset
        </button>
        <div class="ic-sitrep-map__legend">
          <span class="ic-sitrep-legend-item">
            <span class="ic-sitrep-dot ic-sitrep-dot--critical" /> Critical
          </span>
          <span class="ic-sitrep-legend-item">
            <span class="ic-sitrep-dot ic-sitrep-dot--high" /> Hoog
          </span>
          <span class="ic-sitrep-legend-item">
            <span class="ic-sitrep-dot ic-sitrep-dot--warning" /> Middel
          </span>
          <span class="ic-sitrep-legend-item">
            <span class="ic-sitrep-dot ic-sitrep-dot--ok" /> Laag
          </span>
          <span class="ic-sitrep-legend-item ic-sitrep-map__count">
            {{ incidentCountOnMap }} op kaart
          </span>
          <button
            type="button"
            class="ic-sitrep-map__layer-toggle ic-sitrep-legend-item"
            :class="{ 'ic-sitrep-map__layer-toggle--active': showHeatmap }"
            :aria-pressed="showHeatmap"
            :aria-expanded="showHeatmap"
            @click="onHeatmapClick"
          >
            <i class="pi pi-chart-scatter" aria-hidden="true" />
            Heatmap
          </button>
        </div>
        <Popover ref="heatmapPopoverRef" class="ic-sitrep-map__heatmap-popover-panel">
          <div class="ic-sitrep-map__heatmap-popover">
            <label class="ic-sitrep-map__heatmap-scale">
              <span class="ic-sitrep-map__heatmap-scale-label">
                Max drempel: {{ heatmapTopThreshold }}+ incidenten
              </span>
              <input
                v-model.number="heatmapTopThreshold"
                class="ic-sitrep-map__heatmap-slider"
                type="range"
                :min="HEATMAP_TOP_THRESHOLD_MIN"
                :max="HEATMAP_TOP_THRESHOLD_MAX"
                step="1"
                aria-label="Heatmap drempel schalen"
              >
            </label>
            <div class="ic-sitrep-map__heatmap-popover-legend">
              <span
                v-for="tier in heatmapTiers"
                :key="tier.minCount"
                class="ic-sitrep-legend-item ic-sitrep-map__heatmap-tier"
              >
                <span
                  class="ic-sitrep-map__heatmap-swatch"
                  :style="{ backgroundColor: heatmapTierLegendColor(tier) }"
                  aria-hidden="true"
                />
                {{ heatmapTierLabel(tier) }}
              </span>
            </div>
            <button
              type="button"
              class="ic-sitrep-map__heatmap-disable"
              @click="disableHeatmap"
            >
              Heatmap uit
            </button>
          </div>
        </Popover>
      </div>
    </header>

    <div class="ic-sitrep-map__frame">
      <div
        ref="viewportRef"
        class="ic-sitrep-map__viewport"
        @click="onViewportClick"
        @touchstart.passive="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <div class="ic-sitrep-map__stage" :style="[transformStyle, stageSizeStyle]">
          <img
            ref="imageRef"
            :src="rasterMap"
            alt="Congreslocatie rasterkaart"
            class="ic-sitrep-map__image"
            decoding="async"
            draggable="false"
          >
          <canvas
            v-show="showHeatmap"
            ref="heatmapCanvasRef"
            class="ic-sitrep-map__heatmap"
            aria-hidden="true"
          />
          <div class="ic-sitrep-map__markers" :style="markerLayerStyle">
            <button
              v-for="{ sector, position, incidents, count, severity, highlightedIncident } in markers"
              :key="sector"
              :ref="el => setMarkerRef(sector, el)"
              type="button"
              :class="[
                severityMarkerClass(severity),
                {
                  'ic-sitrep-marker--active': hoveredSector === sector
                    || activePickerSector === sector
                    || highlightedIncident !== null,
                },
              ]"
              :style="{ left: position.left, top: position.top }"
              :aria-label="count > 1
                ? `${count} incidenten op ${sector}`
                : `${incidents[0]!.incidentId} op ${sector}`"
              :aria-expanded="count > 1 ? activePickerSector === sector : undefined"
              @click.stop="onMarkerClick(sector, incidents, count)"
              @mousedown.stop
              @touchstart.stop
              @pointerdown.stop
              @mouseenter="hoveredSector = sector; scheduleOverlayPositionUpdate()"
              @mouseleave="hoveredSector = null"
              @focus="hoveredSector = sector; scheduleOverlayPositionUpdate()"
              @blur="hoveredSector = null"
            >
              <span class="ic-sitrep-marker__pulse" aria-hidden="true" />
              <span
                v-if="count > 1"
                :class="['ic-sitrep-marker__count', `ic-sitrep-marker__count--${severity}`]"
                aria-hidden="true"
              >
                {{ count }}
              </span>
              <span class="ic-sitrep-marker__label">{{ sector }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="overlayMarker && overlayStyle && overlayMode"
      class="ic-sitrep-map__overlays"
      :class="{ 'ic-sitrep-map__overlays--below': overlayPlacement === 'below' }"
      :style="overlayStyle"
    >
      <div
        v-if="overlayMode === 'picker'"
        class="ic-sitrep-marker-picker"
        role="menu"
        @click.stop
      >
        <p class="ic-sitrep-marker-picker__heading">
          {{ overlayMarker.count }} incidenten · {{ overlayMarker.sector }}
        </p>
        <ul class="ic-sitrep-marker-picker__list">
          <li
            v-for="incident in overlayMarker.incidents"
            :key="incident.incidentId"
            role="none"
          >
            <button
              type="button"
              class="ic-sitrep-marker-picker__item"
              role="menuitem"
              @click.stop="onPickerSelect(incident)"
            >
              <span
                :class="severityDotClass(getIncidentSeverity(incident))"
                class="ic-sitrep-marker-picker__dot"
                aria-hidden="true"
              />
              <span class="ic-sitrep-marker-picker__copy">
                <span class="ic-sitrep-marker-picker__id">{{ incident.incidentId }}</span>
                <span class="ic-sitrep-marker-picker__type">{{ incident.incidentTypeName }}</span>
                <span class="ic-sitrep-marker-picker__meta">
                  {{ incident.priority }} · {{ incident.status }} · {{ formatTime(incident.timestamp) }}
                </span>
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div
        v-else
        class="ic-sitrep-tooltip"
        :class="{
          'ic-sitrep-tooltip--stack': overlayMarker.count > 1 && overlayMode === 'hover',
          'ic-sitrep-tooltip--below': overlayPlacement === 'below',
        }"
        role="tooltip"
      >
        <template v-if="overlayMarker.count > 1 && overlayMode === 'hover'">
          <p class="ic-sitrep-tooltip__heading">
            {{ overlayMarker.count }} incidenten · {{ overlayMarker.sector }}
          </p>
          <div
            v-for="incident in overlayMarker.incidents"
            :key="incident.incidentId"
            class="ic-sitrep-tooltip__entry"
          >
            <p class="ic-sitrep-tooltip__id">
              {{ incident.incidentId }}
            </p>
            <p class="ic-sitrep-tooltip__type">
              {{ incident.incidentTypeName }}
            </p>
            <p class="ic-sitrep-tooltip__loc">
              {{ incident.locationName }} · {{ incident.sector }}
            </p>
            <p class="ic-sitrep-tooltip__meta">
              {{ incident.priority }} · {{ incident.status }} · {{ formatTime(incident.timestamp) }}
            </p>
            <p v-if="incident.description" class="ic-sitrep-tooltip__desc">
              {{ incident.description }}
            </p>
          </div>
        </template>
        <template v-else-if="overlayIncident">
          <p class="ic-sitrep-tooltip__id">
            {{ overlayIncident.incidentId }}
          </p>
          <p class="ic-sitrep-tooltip__type">
            {{ overlayIncident.incidentTypeName }}
          </p>
          <p class="ic-sitrep-tooltip__loc">
            {{ overlayIncident.locationName }} · {{ overlayMarker.sector }}
          </p>
          <p class="ic-sitrep-tooltip__meta">
            {{ overlayIncident.priority }} · {{ overlayIncident.status }} · {{ formatTime(overlayIncident.timestamp) }}
          </p>
          <p v-if="overlayIncident.description" class="ic-sitrep-tooltip__desc">
            {{ overlayIncident.description }}
          </p>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ic-sitrep-map--panel {
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  height: 100%;
}

.ic-sitrep-map__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  flex-shrink: 0;
  padding: 0.75rem 1rem 0.625rem;
  position: relative;
  z-index: 1;
}

.ic-sitrep-map__header-main {
  min-width: 0;
}

.ic-sitrep-map__header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.375rem;
  margin-left: auto;
}

.ic-sitrep-map__legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.625rem;
  font-size: 0.6875rem;
  color: #64748b;
}

.ic-sitrep-map__legend .ic-sitrep-map__layer-toggle {
  margin-left: 0.125rem;
  padding: 0 0 0 0.625rem;
  border: none;
  border-left: 1px solid rgb(135 161 198 / 0.45);
  border-radius: 0;
  background: transparent;
  color: var(--ic-brand);
}

.ic-sitrep-map__legend .ic-sitrep-map__layer-toggle:hover,
.ic-sitrep-map__legend .ic-sitrep-map__layer-toggle:focus-visible {
  background: transparent;
  color: var(--ic-brand-dark);
  outline: none;
}

.ic-sitrep-map__legend .ic-sitrep-map__layer-toggle--active {
  border-color: rgb(135 161 198 / 0.45);
  background: transparent;
  color: rgb(153 27 27);
}

.ic-sitrep-map__layer-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid rgb(135 161 198 / 0.55);
  border-radius: 0.375rem;
  background: #fff;
  color: var(--ic-brand);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
}

.ic-sitrep-map__layer-toggle:hover,
.ic-sitrep-map__layer-toggle:focus-visible {
  background: rgb(135 161 198 / 0.12);
  outline: none;
}

.ic-sitrep-map__layer-toggle--active {
  border-color: rgb(215 48 39 / 0.55);
  background: rgb(215 48 39 / 0.1);
  color: rgb(153 27 27);
}

.ic-sitrep-map__heatmap-popover {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.75rem 1rem;
  min-width: min(100%, 20rem);
  padding: 0.125rem;
}

.ic-sitrep-map__heatmap-scale {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1 1 9rem;
  min-width: 8.5rem;
  font-size: 0.6875rem;
  color: #64748b;
}

.ic-sitrep-map__heatmap-popover-legend {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 0 0 auto;
  font-size: 0.6875rem;
  color: #64748b;
}

.ic-sitrep-map__heatmap-disable {
  flex: 1 0 100%;
  padding: 0.25rem 0;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.6875rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.ic-sitrep-map__heatmap-disable:hover,
.ic-sitrep-map__heatmap-disable:focus-visible {
  color: rgb(153 27 27);
  outline: none;
}

.ic-sitrep-map__heatmap-scale-label {
  font-weight: 600;
  color: var(--ic-brand-dark);
}

.ic-sitrep-map__heatmap-slider {
  width: 100%;
  accent-color: rgb(139 0 0);
  cursor: pointer;
}

.ic-sitrep-map__title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ic-brand-dark);
}

.ic-sitrep-map__hint {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: #94a3b8;
}

.ic-sitrep-map__reset {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid rgb(135 161 198 / 0.55);
  border-radius: 0.375rem;
  background: #fff;
  color: var(--ic-brand);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
}

.ic-sitrep-map__reset:hover {
  background: rgb(135 161 198 / 0.12);
}

.ic-sitrep-map__heatmap-tier {
  gap: 0.3125rem;
}

.ic-sitrep-map__heatmap-swatch {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  border: 1px solid rgb(15 23 42 / 0.18);
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.5);
}

.ic-sitrep-map__frame {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  border-top: 1px solid rgb(135 161 198 / 0.2);
  background: #fff;
  position: relative;
  z-index: 0;
}

.ic-sitrep-map__overlays {
  position: absolute;
  z-index: 200;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 0.5rem));
}

.ic-sitrep-map__overlays--below {
  transform: translate(-50%, 0.5rem);
}

.ic-sitrep-map__overlays .ic-sitrep-marker-picker {
  pointer-events: auto;
}

.ic-sitrep-map__viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ic-sitrep-map__viewport:active {
  cursor: grabbing;
}

.ic-sitrep-map__stage {
  position: relative;
  flex-shrink: 0;
  transform-origin: center center;
  will-change: transform;
}

.ic-sitrep-map__image {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  pointer-events: none;
  opacity: 0.7;
}

.ic-sitrep-map__heatmap {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.ic-sitrep-map__markers {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ic-sitrep-marker {
  position: absolute;
  transform: translate(-50%, -50%) scale(calc(1 / var(--map-scale, 1)));
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 9999px;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
  transition: box-shadow 0.15s;
}

.ic-sitrep-marker:hover,
.ic-sitrep-marker:focus,
.ic-sitrep-marker--active {
  transform: translate(-50%, -50%) scale(calc(1.25 / var(--map-scale, 1)));
  z-index: 10;
  outline: none;
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.45);
}

.ic-sitrep-marker__pulse {
  position: absolute;
  inset: -4px;
  border-radius: 9999px;
  animation: ic-pulse 2s ease-out infinite;
}

.ic-sitrep-marker--critical {
  background: var(--ic-critical);
}

.ic-sitrep-marker--critical .ic-sitrep-marker__pulse {
  background: rgb(153 27 27 / 0.35);
}

.ic-sitrep-marker--high {
  background: var(--ic-high);
}

.ic-sitrep-marker--high .ic-sitrep-marker__pulse {
  background: rgb(239 68 68 / 0.35);
}

.ic-sitrep-marker--warning {
  background: var(--ic-orange);
}

.ic-sitrep-marker--warning .ic-sitrep-marker__pulse {
  background: rgb(230 151 50 / 0.35);
}

.ic-sitrep-marker--ok {
  background: #22c55e;
}

.ic-sitrep-marker--ok .ic-sitrep-marker__pulse {
  background: rgb(34 197 94 / 0.35);
}

.ic-sitrep-marker--closed {
  background: #94a3b8;
}

.ic-sitrep-marker--closed .ic-sitrep-marker__pulse {
  display: none;
}

.ic-sitrep-marker__count {
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
  line-height: 1;
  color: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
}

.ic-sitrep-marker__count--critical {
  background: var(--ic-critical);
}

.ic-sitrep-marker__count--high {
  background: var(--ic-high);
}

.ic-sitrep-marker__count--warning {
  background: var(--ic-orange);
}

.ic-sitrep-marker__count--ok {
  background: #22c55e;
}

.ic-sitrep-marker__count--closed {
  background: #94a3b8;
}

.ic-sitrep-marker__label {
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

.ic-sitrep-tooltip {
  position: relative;
  z-index: 20;
  width: max-content;
  max-width: 16rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  background: rgb(28 29 82 / 0.95);
  color: #fff;
  font-size: 0.75rem;
  line-height: 1.4;
  text-align: left;
  pointer-events: none;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);
}

.ic-sitrep-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgb(28 29 82 / 0.95);
}

.ic-sitrep-tooltip--below::after {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom-color: rgb(28 29 82 / 0.95);
}

.ic-sitrep-tooltip--stack {
  max-width: 18rem;
}

.ic-sitrep-tooltip__heading {
  margin-bottom: 0.5rem;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid rgb(255 255 255 / 0.2);
  font-weight: 700;
  font-size: 0.8125rem;
}

.ic-sitrep-tooltip__entry + .ic-sitrep-tooltip__entry {
  margin-top: 0.625rem;
  padding-top: 0.625rem;
  border-top: 1px solid rgb(255 255 255 / 0.15);
}

.ic-sitrep-tooltip__id {
  font-weight: 700;
  font-size: 0.8125rem;
}

.ic-sitrep-tooltip__type {
  margin-top: 0.125rem;
  font-weight: 600;
  color: var(--ic-accent);
}

.ic-sitrep-tooltip__loc {
  margin-top: 0.25rem;
}

.ic-sitrep-tooltip__meta {
  margin-top: 0.25rem;
  color: rgb(255 255 255 / 0.75);
}

.ic-sitrep-tooltip__desc {
  margin-top: 0.375rem;
  color: rgb(255 255 255 / 0.9);
}

.ic-sitrep-marker-picker {
  position: relative;
  z-index: 30;
  width: max-content;
  max-width: min(18rem, 70vw);
  max-height: min(16rem, 50vh);
  overflow-y: auto;
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: rgb(28 29 82 / 0.97);
  color: #fff;
  text-align: left;
  pointer-events: auto;
  box-shadow: 0 4px 20px rgb(0 0 0 / 0.35);
}

.ic-sitrep-marker-picker__heading {
  margin: 0 0 0.375rem;
  padding: 0 0.25rem 0.375rem;
  border-bottom: 1px solid rgb(255 255 255 / 0.2);
  font-weight: 700;
  font-size: 0.75rem;
}

.ic-sitrep-marker-picker__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ic-sitrep-marker-picker__item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.ic-sitrep-marker-picker__item:hover,
.ic-sitrep-marker-picker__item:focus-visible {
  background: rgb(255 255 255 / 0.12);
  outline: none;
}

.ic-sitrep-marker-picker__dot {
  flex-shrink: 0;
  margin-top: 0.1875rem;
}

.ic-sitrep-marker-picker__copy {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.ic-sitrep-marker-picker__id {
  font-weight: 700;
  font-size: 0.8125rem;
}

.ic-sitrep-marker-picker__type {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ic-accent);
}

.ic-sitrep-marker-picker__meta {
  font-size: 0.6875rem;
  color: rgb(255 255 255 / 0.75);
}

@keyframes ic-pulse {
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  70% {
    transform: scale(1.8);
    opacity: 0;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}
</style>
