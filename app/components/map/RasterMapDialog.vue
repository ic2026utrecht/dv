<script setup lang="ts">
import rasterMap from '~/assets/images/raster-map.png'
import { buildRasterMapCells, pickSectorAtClientPoint } from '~/constants/rasterMapGrid'

const visible = defineModel<boolean>({ default: false })

defineProps<{
  selectedSector?: string | null
}>()

const emit = defineEmits<{
  select: [sectorCode: string]
}>()

const cells = buildRasterMapCells()
const viewportRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const pendingSector = ref<string | null>(null)

const pinchZoom = usePinchZoom({ maxScale: 8 })
const {
  transformStyle,
  reset,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
} = pinchZoom

useSitrepMapFit(viewportRef, imageRef, pinchZoom)

watch(visible, (open) => {
  if (!open) {
    reset()
    pendingSector.value = null
  }
})

watch(viewportRef, (el, _prev, onCleanup) => {
  if (!el) {
    return
  }

  // Vue @wheel is not reliably non-passive inside a modal with overflow:hidden.
  el.addEventListener('wheel', onWheel, { passive: false })
  onCleanup(() => el.removeEventListener('wheel', onWheel))
}, { flush: 'post' })

function close() {
  visible.value = false
}

function onCellTap(code: string) {
  pendingSector.value = code
}

function confirmSelection() {
  if (!pendingSector.value) {
    return
  }

  emit('select', pendingSector.value)
  pendingSector.value = null
  close()
}

function cancelSelection() {
  pendingSector.value = null
}

function trySelectAt(clientX: number, clientY: number) {
  if (!stageRef.value) {
    return
  }

  const code = pickSectorAtClientPoint(clientX, clientY, stageRef.value)
  if (code) {
    onCellTap(code)
  }
}

function handleTouchEnd(event: TouchEvent) {
  const isTap = onTouchEnd()
  const touch = event.changedTouches[0]
  if (isTap && touch) {
    trySelectAt(touch.clientX, touch.clientY)
  }
}

function handlePointerUp(event: PointerEvent) {
  const isTap = onPointerUp(event)
  if (isTap && event.pointerType === 'mouse') {
    trySelectAt(event.clientX, event.clientY)
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :closable="false"
    :show-header="false"
    :draggable="false"
    :dismissable-mask="true"
    block-scroll
    class="ic-raster-dialog"
    content-class="ic-raster-dialog__content"
    @hide="reset"
  >
    <button
      type="button"
      class="ic-raster-dialog__close"
      aria-label="Sluit rasterkaart"
      @click="close"
    >
      <i class="pi pi-times" aria-hidden="true" />
    </button>

    <div class="ic-raster-dialog__toolbar">
      <p class="ic-raster-dialog__title">
        Rasterkaart · A–M × 1–22
      </p>
      <p class="ic-raster-dialog__hint">
        Scroll/knijp om te zoomen · sleep om te verschuiven · tik om te markeren
      </p>
    </div>

    <div
      ref="viewportRef"
      class="ic-raster-dialog__viewport"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchEnd"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
    >
      <div ref="stageRef" class="ic-raster-dialog__stage" :style="transformStyle">
        <img
          ref="imageRef"
          :src="rasterMap"
          alt=""
          class="ic-raster-dialog__image"
          decoding="async"
          draggable="false"
        >
        <div class="ic-raster-dialog__grid" aria-hidden="true">
          <div
            v-for="cell in cells"
            :key="cell.code"
            class="ic-raster-cell"
            :class="{
              'ic-raster-cell--selected': selectedSector === cell.code && pendingSector !== cell.code,
              'ic-raster-cell--pending': pendingSector === cell.code,
            }"
            :style="cell.style"
          />
        </div>
      </div>
    </div>

    <div
      v-if="pendingSector"
      class="ic-raster-dialog__confirm"
      role="status"
      aria-live="polite"
    >
      <p class="ic-raster-dialog__confirm-text">
        Sector <strong>{{ pendingSector }}</strong> selecteren?
      </p>
      <div class="ic-raster-dialog__confirm-actions">
        <Button
          label="Annuleren"
          severity="secondary"
          text
          @click="cancelSelection"
        />
        <Button
          label="Bevestigen"
          icon="pi pi-check"
          @click="confirmSelection"
        />
      </div>
    </div>
  </Dialog>
</template>

<style>
.ic-raster-dialog.p-dialog {
  width: 100vw !important;
  max-width: 100vw !important;
  height: 100dvh !important;
  max-height: 100dvh !important;
  margin: 0 !important;
  border-radius: 0 !important;
  border: none !important;
  box-shadow: none !important;
  /* PrimeVue sets transform: scale(1), which steals desktop pinch/wheel from the map. */
  transform: none !important;
}

.ic-raster-dialog .p-dialog-content {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  padding: 0 !important;
  overflow: hidden;
  background: var(--ic-brand-dark);
}

.ic-raster-dialog__close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid rgb(255 255 255 / 0.25);
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.35);
  color: #fff;
  font-size: 1.125rem;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-tap-highlight-color: transparent;
}

.ic-raster-dialog__close:hover {
  background: rgb(0 0 0 / 0.5);
}

.ic-raster-dialog__toolbar {
  flex-shrink: 0;
  padding: 0.875rem 4rem 0.75rem 1rem;
  border-bottom: 1px solid rgb(255 255 255 / 0.12);
  background: linear-gradient(135deg, var(--ic-brand-dark) 0%, var(--ic-brand) 100%);
  color: #fff;
}

.ic-raster-dialog__title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.ic-raster-dialog__hint {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: var(--ic-accent);
}

.ic-raster-dialog__viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  touch-action: none;
  overscroll-behavior: none;
  cursor: grab;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ic-raster-dialog__viewport:active {
  cursor: grabbing;
}

.ic-raster-dialog__stage {
  position: relative;
  width: 100%;
  flex-shrink: 0;
  transform-origin: center center;
  will-change: transform;
}

.ic-raster-dialog__image {
  display: block;
  width: 100%;
  height: auto;
  max-width: none;
  pointer-events: none;
}

.ic-raster-dialog__grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ic-raster-cell {
  position: absolute;
  border: 1px solid rgb(45 46 126 / 0.08);
  background: rgb(135 161 198 / 0.04);
  pointer-events: none;
}

.ic-raster-cell--selected {
  background: rgb(230 151 50 / 0.22);
  border-color: rgb(230 151 50 / 0.45);
  box-shadow: inset 0 0 0 1px rgb(230 151 50 / 0.35);
}

.ic-raster-cell--pending {
  background: rgb(230 151 50 / 0.48);
  border-color: var(--ic-orange);
  box-shadow:
    inset 0 0 0 2px rgb(230 151 50 / 0.75),
    0 0 0 2px rgb(230 151 50 / 0.35);
}

.ic-raster-dialog__confirm {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem calc(0.875rem + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgb(255 255 255 / 0.12);
  background: linear-gradient(135deg, var(--ic-brand-dark) 0%, var(--ic-brand) 100%);
  color: #fff;
}

.ic-raster-dialog__confirm-text {
  font-size: 0.9375rem;
}

.ic-raster-dialog__confirm-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}
</style>
