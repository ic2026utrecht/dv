<script setup lang="ts">
import type { RasterGeoAnchor, RasterGeoAnchorKey, RasterMapDefinition, RasterMapGridBounds } from '~/types/models'
import { DEFAULT_RASTER_MAP_GEO_ANCHORS, isGeorefCalibrated, JAARBEURS_MAP_CENTER } from '~/constants/defaultRasterMap'
import { buildRasterMapCells, getSectorImageFraction } from '~/constants/rasterMapGrid'
import { recomputeAnchorFractions, useAdminRasterMaps } from '~/composables/useAdminRasterMaps'
import { RASTER_COLUMNS, RASTER_ROWS } from '~/utils/incidentOptions'

useHead({ title: 'Kaart bewerken — Admin — IC2026 DV' })

const route = useRoute()
const mapId = computed(() => String(route.params.id || ''))

const { getMap, updateMap, uploadImage } = useAdminRasterMaps()
const { fetchConfig } = useIncidents()

const map = ref<RasterMapDefinition | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)
const saveMsg = ref<string | null>(null)
const editorTab = ref<'grid' | 'geo'>('grid')

const name = ref('')
const gridBounds = ref<RasterMapGridBounds>({ left: 0, top: 0, right: 1, bottom: 1 })
const geoAnchors = ref<Partial<Record<RasterGeoAnchorKey, RasterGeoAnchor>>>({})
const selectedAnchor = ref<RasterGeoAnchorKey>('nw')

const viewportRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)

const pinchZoom = usePinchZoom({ maxScale: 3 })
const {
  transformStyle,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
} = pinchZoom
const { updateMapFit, resetMapView, stageSizeStyle } = useSitrepMapFit(viewportRef, imageRef, pinchZoom)

const cells = computed(() =>
  buildRasterMapCells(RASTER_ROWS, RASTER_COLUMNS, gridBounds.value),
)

const cornerOptions = [
  { value: 'top-left', label: 'Linksboven' },
  { value: 'top-right', label: 'Rechtsboven' },
  { value: 'bottom-left', label: 'Linksonder' },
  { value: 'bottom-right', label: 'Rechtsonder' },
]

const sectorOptions = RASTER_ROWS.flatMap(row =>
  RASTER_COLUMNS.map(col => ({ value: `${row}${col}`, label: `${row}${col}` })),
)

const anchorKeys: { key: RasterGeoAnchorKey, label: string }[] = [
  { key: 'nw', label: 'NW' },
  { key: 'ne', label: 'NE' },
  { key: 'sw', label: 'SW' },
  { key: 'se', label: 'SE' },
]

async function load() {
  loading.value = true
  error.value = null
  try {
    const row = await getMap(mapId.value)
    if (!row) {
      error.value = 'Kaart niet gevonden'
      map.value = null
      return
    }
    map.value = row
    name.value = row.name
    gridBounds.value = { ...row.gridBounds }
    geoAnchors.value = { ...row.geoAnchors }
    ensureAnchors()
    await nextTick()
    updateMapFit()
    resetMapView()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Laden mislukt'
  }
  finally {
    loading.value = false
  }
}

function ensureAnchors() {
  for (const key of ['nw', 'ne', 'sw', 'se'] as const) {
    if (!geoAnchors.value[key]) {
      geoAnchors.value[key] = { ...DEFAULT_RASTER_MAP_GEO_ANCHORS[key] }
    }
  }
}

onMounted(load)
watch(mapId, load)

function clampBound(value: number) {
  return Math.min(1, Math.max(0, value))
}

function onBoundInput(key: keyof RasterMapGridBounds, raw: string) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return
  gridBounds.value = { ...gridBounds.value, [key]: clampBound(n) }
  syncAnchorFxFy()
}

function syncAnchorFxFy() {
  geoAnchors.value = recomputeAnchorFractions(
    geoAnchors.value,
    gridBounds.value,
    RASTER_ROWS,
    RASTER_COLUMNS,
  )
}

type DragHandle = 'nw' | 'ne' | 'sw' | 'se' | null
const dragHandle = ref<DragHandle>(null)

function startBoundDrag(handle: Exclude<DragHandle, null>, event: PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
  dragHandle.value = handle
  ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
}

function onBoundPointerMove(event: PointerEvent) {
  if (!dragHandle.value || !stageRef.value) return
  const rect = stageRef.value.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  const fx = clampBound((event.clientX - rect.left) / rect.width)
  const fy = clampBound((event.clientY - rect.top) / rect.height)
  const next = { ...gridBounds.value }
  const h = dragHandle.value
  if (h === 'nw' || h === 'sw') next.left = Math.min(fx, next.right - 0.02)
  if (h === 'ne' || h === 'se') next.right = Math.max(fx, next.left + 0.02)
  if (h === 'nw' || h === 'ne') next.top = Math.min(fy, next.bottom - 0.02)
  if (h === 'sw' || h === 'se') next.bottom = Math.max(fy, next.top + 0.02)
  gridBounds.value = next
  syncAnchorFxFy()
}

function endBoundDrag() {
  dragHandle.value = null
}

function onAnchorSectorChange(key: RasterGeoAnchorKey, sector: string) {
  const a = geoAnchors.value[key]
  if (!a) return
  const frac = getSectorImageFraction(sector, a.corner, RASTER_ROWS, RASTER_COLUMNS, gridBounds.value)
  geoAnchors.value[key] = {
    ...a,
    sector,
    fx: frac?.fx ?? a.fx,
    fy: frac?.fy ?? a.fy,
  }
}

function onAnchorCornerChange(key: RasterGeoAnchorKey, corner: RasterGeoAnchor['corner']) {
  const a = geoAnchors.value[key]
  if (!a) return
  const frac = getSectorImageFraction(a.sector, corner, RASTER_ROWS, RASTER_COLUMNS, gridBounds.value)
  geoAnchors.value[key] = {
    ...a,
    corner,
    fx: frac?.fx ?? a.fx,
    fy: frac?.fy ?? a.fy,
  }
}

function nudge(key: RasterGeoAnchorKey, field: 'lat' | 'lng', delta: number) {
  const a = geoAnchors.value[key]
  if (!a) return
  geoAnchors.value[key] = { ...a, [field]: a[field] + delta }
}

async function onSave() {
  if (!map.value) return
  saving.value = true
  saveMsg.value = null
  error.value = null
  try {
    const updated = await updateMap(map.value.id, {
      name: name.value,
      gridBounds: gridBounds.value,
      geoAnchors: geoAnchors.value,
      recomputeAnchorFxFy: true,
    })
    map.value = updated
    geoAnchors.value = { ...updated.geoAnchors }
    await fetchConfig(true).catch(() => {})
    saveMsg.value = 'Opgeslagen'
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Opslaan mislukt'
  }
  finally {
    saving.value = false
  }
}

async function onUpload(event: Event) {
  if (!map.value) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const path = await uploadImage(file, map.value.id)
    const updated = await updateMap(map.value.id, { imagePath: path })
    map.value = updated
    await fetchConfig(true).catch(() => {})
    saveMsg.value = 'Afbeelding geüpload'
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Upload mislukt'
  }
}

const calibrated = computed(() => isGeorefCalibrated(geoAnchors.value))

// --- Geo preview (Leaflet) ---
const geoPreviewEl = ref<HTMLElement | null>(null)
let previewMap: import('leaflet').Map | null = null

async function initGeoPreview() {
  if (!import.meta.client || !geoPreviewEl.value) return
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  ;(globalThis as unknown as { L: typeof L }).L = L
  await import('leaflet-imageoverlay-rotated')

  if (previewMap) {
    previewMap.remove()
    previewMap = null
  }

  previewMap = L.map(geoPreviewEl.value, { zoomControl: true })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap',
  }).addTo(previewMap)

  const { imageCornerLatLngs, anchorBoundsLatLngs } = await import('~/utils/rasterMapProjection')
  const corners = imageCornerLatLngs(geoAnchors.value)
  if (corners && map.value) {
    const rotated = (L.imageOverlay as unknown as {
      rotated: (
        url: string,
        tl: L.LatLngExpression,
        tr: L.LatLngExpression,
        bl: L.LatLngExpression,
        options?: L.ImageOverlayOptions,
      ) => L.ImageOverlay
    }).rotated(
      map.value.imageUrl,
      [corners.topLeft.lat, corners.topLeft.lng],
      [corners.topRight.lat, corners.topRight.lng],
      [corners.bottomLeft.lat, corners.bottomLeft.lng],
      { opacity: 0.55, interactive: false },
    )
    rotated.addTo(previewMap)
  }

  for (const { key, label } of anchorKeys) {
    const a = geoAnchors.value[key]
    if (!a) continue
    L.circleMarker([a.lat, a.lng], {
      radius: key === selectedAnchor.value ? 8 : 6,
      color: '#fff',
      weight: 2,
      fillColor: key === selectedAnchor.value ? '#e69732' : '#1c1d52',
      fillOpacity: 1,
    })
      .bindTooltip(`${label} ${a.sector}`, { permanent: false })
      .addTo(previewMap)
  }

  const pts = anchorBoundsLatLngs(geoAnchors.value)
  if (pts?.length) {
    previewMap.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng] as [number, number])), {
      padding: [20, 20],
      maxZoom: 18,
    })
  }
  else {
    previewMap.setView([JAARBEURS_MAP_CENTER.lat, JAARBEURS_MAP_CENTER.lng], JAARBEURS_MAP_CENTER.zoom)
  }

  previewMap.on('click', (e: import('leaflet').LeafletMouseEvent) => {
    const key = selectedAnchor.value
    const a = geoAnchors.value[key]
    if (!a) return
    geoAnchors.value[key] = { ...a, lat: e.latlng.lat, lng: e.latlng.lng }
  })

  requestAnimationFrame(() => previewMap?.invalidateSize())
}

let previewRefreshTimer: ReturnType<typeof setTimeout> | null = null

function scheduleGeoPreviewRefresh() {
  if (editorTab.value !== 'geo') return
  if (previewRefreshTimer) clearTimeout(previewRefreshTimer)
  previewRefreshTimer = setTimeout(() => {
    void initGeoPreview()
  }, 400)
}

watch(editorTab, async (tab) => {
  if (tab === 'geo') {
    await nextTick()
    await initGeoPreview()
  }
})

watch([geoAnchors, selectedAnchor], () => {
  scheduleGeoPreviewRefresh()
}, { deep: true })

onBeforeUnmount(() => {
  if (previewRefreshTimer) clearTimeout(previewRefreshTimer)
  previewMap?.remove()
  previewMap = null
})
</script>

<template>
  <div class="space-y-4 p-5 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <NuxtLink
        to="/admin/maps"
        class="text-sm font-semibold text-[var(--ic-brand)]"
      >
        ← Kaarten
      </NuxtLink>
      <Button
        label="Opslaan"
        icon="pi pi-save"
        :loading="saving"
        @click="onSave"
      />
    </div>

    <Message
      v-if="error"
      severity="error"
      :closable="false"
    >
      {{ error }}
    </Message>
    <Message
      v-if="saveMsg"
      severity="success"
      :closable="true"
      @close="saveMsg = null"
    >
      {{ saveMsg }}
    </Message>

    <p
      v-if="loading"
      class="text-sm text-slate-500"
    >
      Laden…
    </p>

    <template v-else-if="map">
      <section class="ic-card space-y-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="ic-label" for="map-name">Naam</label>
            <InputText
              id="map-name"
              v-model="name"
              class="ic-field w-full"
            />
          </div>
          <div>
            <label class="ic-label" for="map-file">Vervang PNG</label>
            <input
              id="map-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              class="text-sm"
              @change="onUpload"
            >
          </div>
        </div>
        <p class="text-xs text-slate-500">
          ID: {{ map.id }} · {{ calibrated ? 'Geo gekalibreerd' : 'Geo incompleet' }}
        </p>
      </section>

      <div class="flex gap-2">
        <Button
          :outlined="editorTab !== 'grid'"
          label="Raster"
          size="small"
          @click="editorTab = 'grid'"
        />
        <Button
          :outlined="editorTab !== 'geo'"
          label="GPS-ankers"
          size="small"
          @click="editorTab = 'geo'"
        />
      </div>

      <section
        v-show="editorTab === 'grid'"
        class="ic-card space-y-3"
      >
        <h2 class="ic-section-heading mb-0">
          Raster op PNG
        </h2>
        <p class="text-xs text-slate-500">
          Sleep de hoeken van het rastervlak, of vul fracties (0–1) in.
        </p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label
            v-for="key in (['left', 'top', 'right', 'bottom'] as const)"
            :key="key"
            class="text-xs"
          >
            <span class="font-semibold uppercase text-slate-600">{{ key }}</span>
            <InputText
              class="ic-field mt-1 w-full"
              :model-value="String(gridBounds[key])"
              @update:model-value="onBoundInput(key, String($event))"
            />
          </label>
        </div>

        <div
          ref="viewportRef"
          class="ic-map-editor__viewport"
          @touchstart.passive="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
          @wheel="onWheel"
          @pointerdown="onPointerDown"
          @pointermove="(e) => { onBoundPointerMove(e); onPointerMove(e) }"
          @pointerup="(e) => { endBoundDrag(); onPointerUp(e) }"
          @pointercancel="(e) => { endBoundDrag(); onPointerUp(e) }"
        >
          <div
            ref="stageRef"
            class="ic-map-editor__stage"
            :style="[transformStyle, stageSizeStyle]"
          >
            <img
              ref="imageRef"
              :src="map.imageUrl"
              alt="Rasterkaart"
              class="ic-map-editor__image"
              draggable="false"
            >
            <div class="ic-map-editor__cells" aria-hidden="true">
              <div
                v-for="cell in cells"
                :key="cell.code"
                class="ic-map-editor__cell"
                :style="cell.style"
              >
                <span>{{ cell.code }}</span>
              </div>
            </div>
            <div
              class="ic-map-editor__bounds"
              :style="{
                left: `${gridBounds.left * 100}%`,
                top: `${gridBounds.top * 100}%`,
                width: `${(gridBounds.right - gridBounds.left) * 100}%`,
                height: `${(gridBounds.bottom - gridBounds.top) * 100}%`,
              }"
            >
              <button
                v-for="h in (['nw', 'ne', 'sw', 'se'] as const)"
                :key="h"
                type="button"
                class="ic-map-editor__handle"
                :class="`ic-map-editor__handle--${h}`"
                aria-label="Sleep rasterhoek"
                @pointerdown="startBoundDrag(h, $event)"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        v-show="editorTab === 'geo'"
        class="ic-card space-y-3"
      >
        <h2 class="ic-section-heading mb-0">
          GPS-ankers
        </h2>
        <p class="text-xs text-slate-500">
          Klik op de OSM-preview om lat/lng van de geselecteerde hoek te zetten. fx/fy volgen uit raster + sector.
        </p>

        <div class="overflow-x-auto">
          <table class="ic-map-editor__table">
            <thead>
              <tr>
                <th>Hoek</th>
                <th>Sector</th>
                <th>Celhoek</th>
                <th>lat</th>
                <th>lng</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="{ key, label } in anchorKeys"
                :key="key"
                :class="{ 'ic-map-editor__row--active': selectedAnchor === key }"
                @click="selectedAnchor = key"
              >
                <td>
                  <strong>{{ label }}</strong>
                </td>
                <td>
                  <Select
                    :model-value="geoAnchors[key]?.sector"
                    :options="sectorOptions"
                    option-label="label"
                    option-value="value"
                    class="w-28"
                    filter
                    @update:model-value="onAnchorSectorChange(key, String($event))"
                  />
                </td>
                <td>
                  <Select
                    :model-value="geoAnchors[key]?.corner"
                    :options="cornerOptions"
                    option-label="label"
                    option-value="value"
                    class="w-36"
                    @update:model-value="onAnchorCornerChange(key, $event as any)"
                  />
                </td>
                <td>
                  <InputText
                    class="w-36"
                    :model-value="String(geoAnchors[key]?.lat ?? '')"
                    @update:model-value="geoAnchors[key] && (geoAnchors[key]!.lat = Number($event))"
                  />
                </td>
                <td>
                  <InputText
                    class="w-36"
                    :model-value="String(geoAnchors[key]?.lng ?? '')"
                    @update:model-value="geoAnchors[key] && (geoAnchors[key]!.lng = Number($event))"
                  />
                </td>
                <td class="whitespace-nowrap">
                  <Button
                    type="button"
                    size="small"
                    text
                    label="↑lat"
                    @click.stop="nudge(key, 'lat', 0.00001)"
                  />
                  <Button
                    type="button"
                    size="small"
                    text
                    label="↓lat"
                    @click.stop="nudge(key, 'lat', -0.00001)"
                  />
                  <Button
                    type="button"
                    size="small"
                    text
                    label="→lng"
                    @click.stop="nudge(key, 'lng', 0.00001)"
                  />
                  <Button
                    type="button"
                    size="small"
                    text
                    label="←lng"
                    @click.stop="nudge(key, 'lng', -0.00001)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ClientOnly>
          <div
            ref="geoPreviewEl"
            class="ic-map-editor__geo-preview"
          />
        </ClientOnly>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ic-map-editor__viewport {
  height: min(70vh, 36rem);
  overflow: hidden;
  border: 1px solid rgb(135 161 198 / 0.35);
  border-radius: 0.5rem;
  touch-action: none;
  cursor: grab;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ic-map-editor__stage {
  position: relative;
  flex-shrink: 0;
  transform-origin: center center;
}

.ic-map-editor__image {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.85;
}

.ic-map-editor__cells {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ic-map-editor__cell {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid rgb(28 29 82 / 0.25);
  font-size: 0.4rem;
  color: rgb(28 29 82 / 0.7);
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 1px;
  overflow: hidden;
}

.ic-map-editor__bounds {
  position: absolute;
  border: 2px solid var(--ic-orange);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.5);
  pointer-events: none;
}

.ic-map-editor__handle {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 9999px;
  background: var(--ic-brand);
  pointer-events: auto;
  cursor: nwse-resize;
  transform: translate(-50%, -50%);
  padding: 0;
}

.ic-map-editor__handle--nw { left: 0; top: 0; cursor: nwse-resize; }
.ic-map-editor__handle--ne { left: 100%; top: 0; cursor: nesw-resize; }
.ic-map-editor__handle--sw { left: 0; top: 100%; cursor: nesw-resize; }
.ic-map-editor__handle--se { left: 100%; top: 100%; cursor: nwse-resize; }

.ic-map-editor__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.ic-map-editor__table th,
.ic-map-editor__table td {
  padding: 0.375rem;
  border-bottom: 1px solid rgb(135 161 198 / 0.25);
  text-align: left;
  vertical-align: middle;
}

.ic-map-editor__row--active {
  background: rgb(230 151 50 / 0.12);
}

.ic-map-editor__geo-preview {
  height: 20rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(135 161 198 / 0.35);
}
</style>
