<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
}>()
</script>

<template>
  <header class="mb-8 text-center">
    <p class="text-sm font-semibold uppercase tracking-wide text-blue-700">
      IC2026 DV
    </p>
    <h1 class="mt-1 text-2xl font-bold text-slate-900">
      {{ title ?? 'Incidentenregistratie' }}
    </h1>
    <p v-if="subtitle" class="mt-2 text-sm text-slate-600">
      {{ subtitle }}
    </p>
  </header>
</template>
