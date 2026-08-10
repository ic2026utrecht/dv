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
      <div class="ic-sitrep-nav">
        <NuxtLink to="/sitrep" class="ic-sitrep-nav__link">
          <i class="pi pi-chart-bar" aria-hidden="true" />
          Sitrep dashboard
        </NuxtLink>
      </div>
      <IncidentForm @submitted="onSubmitted" />
    </div>
  </div>
</template>
