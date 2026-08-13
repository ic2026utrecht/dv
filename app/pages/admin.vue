<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })

useHead({ title: 'Admin — IC2026 DV' })
</script>

<template>
  <div class="ic-page" style="max-width: 48rem;">
    <div class="ic-shell">
      <PageHeader
        title="Admin"
        subtitle="Beheer medewerkers, locaties en incidenttypes"
      />
      <AdminNavTabs />
      <NuxtPage />
    </div>
  </div>
</template>
