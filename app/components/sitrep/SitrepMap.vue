<script setup lang="ts">
import rasterMap from '~/assets/images/raster-map.png'
import { getSectorMarkerPosition } from '~/constants/rasterMapGrid'
import type { Incident } from '~/types/models'
import { getIncidentSeverity, severityMarkerClass, type SitrepSeverity } from '~/utils/sitrepColors'

const props = defineProps<{
  incidents: Incident[]
}>()

const { filterIncidents } = useSitrepQuery()
const hoveredSector = ref<string | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)

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

const { fitScale, resetMapView, stageSizeStyle } = useSitrepMapFit(viewportRef, imageRef, pinchZoom)

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

  return Array.from(bySector.entries()).map(([sector, group]) => ({
    sector,
    position: group.position,
    incidents: group.incidents,
    count: group.incidents.length,
    severity: getHighestSeverity(group.severities),
  }))
})

const incidentCountOnMap = computed(() =>
  markers.value.reduce((total, marker) => total + marker.count, 0),
)

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
</script>

<template>
  <section class="ic-sitrep-map ic-sitrep-map--panel">
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
        </div>
      </div>
    </header>

    <div class="ic-sitrep-map__frame">
      <div
        ref="viewportRef"
        class="ic-sitrep-map__viewport"
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
          <div class="ic-sitrep-map__markers" :style="markerLayerStyle">
            <button
              v-for="{ sector, position, incidents, count, severity } in markers"
              :key="sector"
              type="button"
              :class="[
                severityMarkerClass(severity),
                { 'ic-sitrep-marker--active': hoveredSector === sector },
              ]"
              :style="{ left: position.left, top: position.top }"
              :aria-label="count > 1
                ? `${count} incidenten op ${sector}`
                : `${incidents[0]!.incidentId} op ${sector}`"
              @mouseenter="hoveredSector = sector"
              @mouseleave="hoveredSector = null"
              @focus="hoveredSector = sector"
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

              <div
                v-if="hoveredSector === sector"
                class="ic-sitrep-tooltip"
                :class="{ 'ic-sitrep-tooltip--stack': count > 1 }"
                role="tooltip"
              >
                <template v-if="count > 1">
                  <p class="ic-sitrep-tooltip__heading">
                    {{ count }} incidenten · {{ sector }}
                  </p>
                  <div
                    v-for="incident in incidents"
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
                <template v-else>
                  <p class="ic-sitrep-tooltip__id">
                    {{ incidents[0]!.incidentId }}
                  </p>
                  <p class="ic-sitrep-tooltip__type">
                    {{ incidents[0]!.incidentTypeName }}
                  </p>
                  <p class="ic-sitrep-tooltip__loc">
                    {{ incidents[0]!.locationName }} · {{ incidents[0]!.sector }}
                  </p>
                  <p class="ic-sitrep-tooltip__meta">
                    {{ incidents[0]!.priority }} · {{ incidents[0]!.status }} · {{ formatTime(incidents[0]!.timestamp) }}
                  </p>
                  <p v-if="incidents[0]!.description" class="ic-sitrep-tooltip__desc">
                    {{ incidents[0]!.description }}
                  </p>
                </template>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ic-sitrep-map--panel {
  display: flex;
  flex-direction: column;
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
}

.ic-sitrep-map__header-main {
  min-width: 0;
}

.ic-sitrep-map__header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.375rem;
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

.ic-sitrep-map__legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.625rem;
  font-size: 0.6875rem;
  color: #64748b;
}

.ic-sitrep-map__frame {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  border-top: 1px solid rgb(135 161 198 / 0.2);
  background: #fff;
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
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 50%;
  transform: translateX(-50%);
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
