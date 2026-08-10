<script setup lang="ts">
const route = useRoute()
const incidentId = computed(() => route.query.id as string | undefined)
</script>

<template>
  <div class="ic-page flex flex-col items-center justify-center text-center">
    <div class="ic-card max-w-md p-8">
      <i class="pi pi-check-circle text-5xl text-green-600" />
      <h1 class="mt-4 text-2xl font-bold text-slate-900">
        Melding ontvangen
      </h1>
      <p v-if="incidentId" class="mt-2 text-slate-600">
        Referentie: <strong>{{ incidentId }}</strong>
      </p>
      <p class="mt-4 text-sm text-slate-500">
        Ops kan de melding volgen op het Sitrep-tabblad in Google Sheets.
      </p>
      <Button
        label="Nieuwe melding"
        class="mt-6"
        icon="pi pi-plus"
        @click="navigateTo('/')"
      />
    </div>
  </div>
</template>
