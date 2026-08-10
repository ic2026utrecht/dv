<script setup lang="ts">
useHead({
  title: 'Sitrep — IC2026 DV',
})

const {
  loading,
  refreshing,
  error,
  lastUpdated,
  summary,
  incidents,
  fetchIncidents,
  refreshIncidents,
  startPolling,
  stopPolling,
} = useSitrep()

const { fetchConfig } = useIncidents()
const apiConfig = ref<Awaited<ReturnType<typeof fetchConfig>> | null>(null)
const canUpdateIncidents = computed(() => supportsIncidentUpdate(apiConfig.value))

const createDialogOpen = ref(false)

onMounted(async () => {
  try {
    apiConfig.value = await fetchConfig()
    await fetchIncidents()
    startPolling()
  }
  catch {
    // error state shown in template
  }
})

async function refresh() {
  try {
    await refreshIncidents()
  }
  catch {
    // error state shown in template
  }
}

async function onIncidentCreated() {
  await refresh()
}

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <div class="ic-page ic-page--sitrep">
    <div class="ic-shell ic-shell--sitrep">
      <LayoutPageHeader
        title="Sitrep dashboard"
        subtitle="Live overzicht van open incidenten op de congreslocatie"
      />

      <Message v-if="error" severity="error" class="ic-sitrep-error">
        {{ error }}
      </Message>

      <Message
        v-else-if="apiConfig && !canUpdateIncidents"
        severity="warn"
        class="ic-sitrep-error"
        :closable="false"
      >
        Status wijzigen werkt nog niet: de Sheets API moet opnieuw gedeployed worden.
        Kopieer <code>apps-script/Api.gs</code> naar Apps Script, ga naar
        <strong>Deploy → Manage deployments → Edit → New version → Deploy</strong>.
      </Message>

      <div v-if="loading && !lastUpdated" class="ic-sitrep-loading">
        <ProgressSpinner style="width: 2.5rem; height: 2.5rem" />
        <p>Incidenten laden…</p>
      </div>

      <template v-else>
        <SitrepKpiCards
          :summary="summary"
          :last-updated="lastUpdated"
          :refreshing="refreshing"
          @create="createDialogOpen = true"
          @refresh="refresh"
        />

        <div class="ic-sitrep-split">
          <SitrepMainTabs :incidents="incidents" />
          <SitrepIncidentList :incidents="incidents" />
        </div>
      </template>
    </div>

    <SitrepIncidentCreateDialog
      v-model="createDialogOpen"
      @created="onIncidentCreated"
    />
  </div>
</template>

<style scoped>
.ic-sitrep-error {
  margin: 1rem;
}

.ic-sitrep-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 1rem;
  color: var(--ic-brand);
}
</style>
