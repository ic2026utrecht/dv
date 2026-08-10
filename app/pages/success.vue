<script setup lang="ts">
import ic2026Logo from '~/assets/images/ic2026-co-logo.svg'

const route = useRoute()
const incidentId = computed(() => route.query.id as string | undefined)
</script>

<template>
  <div class="ic-page flex items-center justify-center">
    <div class="ic-shell w-full max-w-md overflow-hidden text-center">
      <div class="ic-header-hero text-center">
        <img
          :src="ic2026Logo"
          alt="IC2026 Congres Nederland"
          class="ic-header-logo mx-auto mb-4"
          width="80"
          height="98"
        >
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(230_151_50/0.2)] ring-4 ring-[rgb(230_151_50/0.35)]">
          <i class="pi pi-check text-3xl text-[var(--ic-orange)]" aria-hidden="true" />
        </div>
        <h1 class="ic-header-title text-xl sm:text-2xl">
          Melding ontvangen
        </h1>
        <p v-if="incidentId" class="mt-3 text-sm text-slate-300">
          Referentie
          <strong class="ml-1 font-mono text-lg text-white">{{ incidentId }}</strong>
        </p>
      </div>

      <div class="space-y-4 px-6 py-8">
        <p class="text-sm leading-relaxed text-slate-600">
          Ops kan de melding volgen op het <strong>Sitrep</strong>-tabblad in Google Sheets.
        </p>
        <Button
          label="Nieuwe melding"
          icon="pi pi-plus"
          size="large"
          class="w-full"
          @click="navigateTo('/')"
        />
      </div>
    </div>
  </div>
</template>
