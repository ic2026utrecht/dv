<script setup lang="ts">
const route = useRoute()
const incidentId = computed(() => route.query.id as string | undefined)
</script>

<template>
  <div class="ic-page flex items-center justify-center">
    <div class="ic-shell w-full max-w-md overflow-hidden text-center">
      <div class="ic-header-hero">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 ring-4 ring-green-400/30">
          <i class="pi pi-check text-3xl text-green-300" aria-hidden="true" />
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
