<script setup lang="ts">
import rasterMap from '~/assets/images/raster-map.png'
import { getSectorMarkerPosition } from '~/constants/rasterMapGrid'
import type { Incident } from '~/types/models'
import { getIncidentSeverity, severityMarkerClass } from '~/utils/sitrepColors'

const props = defineProps<{
  incidents: Incident[]
}>()

const { filterIncidents } = useSitrepQuery()
const hoveredId = ref<string | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)

const pinchZoom = usePinchZoom({ maxScale: 8 })
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

const { fitScale, resetMapView } = useSitrepMapFit(viewportRef, imageRef, pinchZoom)

const markerLayerStyle = computed(() => ({
  '--map-scale': scale.value,
}))

const markers = computed(() =>
  filterIncidents(props.incidents)
    .filter(i => i.sector)
    .map((incident) => {
      const position = getSectorMarkerPosition(incident.sector)
      if (!position) {
        return null
      }
      return {
        incident,
        position,
        severity: getIncidentSeverity(incident),
      }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null),
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
        <h2 class="ic-sitrep-map__title">
          Kaartoverzicht
        </h2>
        <p class="ic-sitrep-map__hint">
          Scroll/knijp om te zoomen · sleep om te verschuiven
        </p>
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
            <span class="ic-sitrep-dot ic-sitrep-dot--critical" /> Critical / Hoog
          </span>
          <span class="ic-sitrep-legend-item">
            <span class="ic-sitrep-dot ic-sitrep-dot--warning" /> Middel
          </span>
          <span class="ic-sitrep-legend-item">
            <span class="ic-sitrep-dot ic-sitrep-dot--ok" /> Laag
          </span>
          <span class="ic-sitrep-legend-item ic-sitrep-map__count">
            {{ markers.length }} op kaart
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
        <div class="ic-sitrep-map__stage" :style="transformStyle">
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
              v-for="{ incident, position, severity } in markers"
              :key="incident.incidentId"
              type="button"
              :class="[
                severityMarkerClass(severity),
                { 'ic-sitrep-marker--active': hoveredId === incident.incidentId },
              ]"
              :style="{ left: position.left, top: position.top }"
              :aria-label="`${incident.incidentId} op ${incident.sector}`"
              @mouseenter="hoveredId = incident.incidentId"
              @mouseleave="hoveredId = null"
              @focus="hoveredId = incident.incidentId"
              @blur="hoveredId = null"
            >
              <span class="ic-sitrep-marker__pulse" aria-hidden="true" />
              <span class="ic-sitrep-marker__label">{{ incident.sector }}</span>

              <div
                v-if="hoveredId === incident.incidentId"
                class="ic-sitrep-tooltip"
                role="tooltip"
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
  width: 100%;
  flex-shrink: 0;
  transform-origin: center center;
  will-change: transform;
}

.ic-sitrep-map__image {
  display: block;
  width: 100%;
  height: auto;
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
  background: rgb(186 49 72 / 0.35);
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
