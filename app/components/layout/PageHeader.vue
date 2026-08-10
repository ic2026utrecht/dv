<script setup lang="ts">
import ic2026Logo from '~/assets/images/ic2026-co-logo.svg'

defineProps<{
  title?: string
  subtitle?: string
  step?: number
}>()
</script>

<template>
  <header class="ic-header-hero">
    <div class="ic-header-brand">
      <img
        :src="ic2026Logo"
        alt="IC2026 Congres Nederland"
        class="ic-header-logo"
        width="72"
        height="88"
      >
      <div class="ic-header-copy">
        <p class="ic-header-kicker">
          IC2026 DV · Live registratie
        </p>
        <h1 class="ic-header-title">
          {{ title ?? 'Incident melden' }}
        </h1>
        <p v-if="subtitle" class="ic-header-sub">
          {{ subtitle }}
        </p>
        <div v-if="step" class="ic-header-step">
          <span class="ic-step-badge">{{ step }}</span>
          Vul alle verplichte velden in
        </div>
      </div>
    </div>
  </header>
</template>
