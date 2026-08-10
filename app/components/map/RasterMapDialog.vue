<script setup lang="ts">
import rasterMap from '~/assets/images/raster-map.png'
import { buildRasterMapCells } from '~/constants/rasterMapGrid'

const visible = defineModel<boolean>({ default: false })

defineProps<{
  selectedSector?: string | null
}>()

const emit = defineEmits<{
  select: [sectorCode: string]
}>()

const cells = buildRasterMapCells()

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
} = usePinchZoom({ maxScale: 8 })

watch(visible, (open) => {
  if (!open) {
    reset()
  }
})

function close() {
  visible.value = false
}

function onCellSelect(code: string) {
  emit('select', code)
  close()
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
        Tik op een vak · knijp om te zoomen · sleep om te verschuiven
      </p>
    </div>

    <div
      class="ic-raster-dialog__viewport"
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
      <div class="ic-raster-dialog__stage" :style="transformStyle">
        <img
          :src="rasterMap"
          alt=""
          class="ic-raster-dialog__image"
          decoding="async"
          draggable="false"
        >
        <div class="ic-raster-dialog__grid" aria-hidden="true">
          <button
            v-for="cell in cells"
            :key="cell.code"
            type="button"
            class="ic-raster-cell"
            :class="{ 'ic-raster-cell--selected': selectedSector === cell.code }"
            :style="cell.style"
            :aria-label="`Sector ${cell.code}`"
            :title="cell.code"
            @click.stop="onCellSelect(cell.code)"
          />
        </div>
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
  cursor: grab;
  user-select: none;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.ic-raster-dialog__viewport:active {
  cursor: grabbing;
}

.ic-raster-dialog__stage {
  position: relative;
  width: 100%;
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
  margin: 0;
  padding: 0;
  border: 1px solid rgb(45 46 126 / 0.08);
  background: rgb(135 161 198 / 0.04);
  pointer-events: auto;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.12s, border-color 0.12s;
}

.ic-raster-cell:hover,
.ic-raster-cell:focus-visible {
  background: rgb(45 46 126 / 0.18);
  border-color: rgb(45 46 126 / 0.45);
  outline: none;
}

.ic-raster-cell--selected {
  background: rgb(230 151 50 / 0.38) !important;
  border-color: var(--ic-orange) !important;
  box-shadow: inset 0 0 0 1px rgb(230 151 50 / 0.55);
}
</style>
