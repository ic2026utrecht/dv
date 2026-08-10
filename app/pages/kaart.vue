<script setup lang="ts">
import rasterMap from '~/assets/images/raster-map.jpg'

useHead({
  title: 'Rasterkaart — IC2026 DV',
})
</script>

<template>
  <div class="ic-page ic-map-page">
    <div class="ic-shell overflow-hidden">
      <div class="ic-header-hero flex items-start justify-between gap-4">
        <div>
          <p class="ic-header-kicker">
            Navigatie
          </p>
          <h1 class="ic-header-title text-xl sm:text-2xl">
            Rasterkaart
          </h1>
          <p class="ic-header-sub mt-2">
            Rij <strong class="text-white">A–M</strong> · Kolom <strong class="text-white">1–22</strong>
          </p>
        </div>
        <Button
          label="Terug"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          class="shrink-0 !border-white/40 !text-white hover:!bg-white/10"
          @click="navigateTo('/')"
        />
      </div>

      <div class="ic-map-viewport">
        <img
          :src="rasterMap"
          alt="Rasterkaart IC2026 DV — rijen A tot M, kolommen 1 tot 22"
          class="ic-map-image"
        >
      </div>

      <div class="border-t-2 border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 sm:px-8">
        <p>
          <strong class="text-slate-900">Tip:</strong>
          Pinch of scroll om in te zoomen. Noteer rij + kolom in het formulier (bijv. <strong>E7</strong>).
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ic-map-page {
  max-width: 56rem;
}

.ic-map-viewport {
  overflow: auto;
  background: #0f172a;
  max-height: min(70vh, 720px);
  -webkit-overflow-scrolling: touch;
}

.ic-map-image {
  display: block;
  width: 100%;
  min-width: 640px;
  height: auto;
}
</style>
