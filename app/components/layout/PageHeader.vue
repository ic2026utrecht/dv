<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
  step?: number
}>()
</script>

<template>
  <header class="ic-header-hero">
    <p class="ic-header-kicker">
      IC2026 DV · Live registratie
    </p>
    <h1 class="ic-header-title">
      {{ title ?? 'Incident melden' }}
    </h1>
    <p v-if="subtitle" class="ic-header-sub">
      {{ subtitle }}
    </p>
    <div v-if="step" class="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
      <span class="ic-step-badge">{{ step }}</span>
      Vul alle verplichte velden in
    </div>
  </header>
</template>
