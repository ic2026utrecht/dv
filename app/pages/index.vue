<script setup lang="ts">
const router = useRouter()

function onSubmitted(incidentId: string) {
  router.push({ path: '/success', query: { id: incidentId } })
}
</script>

<template>
  <div class="ic-page">
    <div class="ic-shell">
      <LayoutPageHeader
        subtitle="Melding gaat direct naar het Sitrep-overzicht in Google Sheets"
        :step="1"
      />
      <IncidentForm @submitted="onSubmitted" />
    </div>
  </div>
</template>
