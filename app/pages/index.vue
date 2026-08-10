<script setup lang="ts">
const router = useRouter()

function onSubmitted(incidentId: string) {
  router.push({ path: '/success', query: { id: incidentId } })
}
</script>

<template>
  <div class="ic-page">
    <LayoutPageHeader
      subtitle="Parkeer · Dienstverlening · EHBO — data wordt opgeslagen in Google Sheets"
    />
    <IncidentForm @submitted="onSubmitted" />
  </div>
</template>
