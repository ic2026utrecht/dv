<script setup lang="ts">
useHead({
  title: 'Rasterkaart — IC2026 DV',
})

const rasterMapOpen = ref(true)

watch(rasterMapOpen, (open) => {
  if (!open) {
    navigateTo('/')
  }
})
</script>

<template>
  <RasterMapDialog v-model="rasterMapOpen" />
</template>
