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

      <div class="ic-sitrep-toolbar">
        <NuxtLink to="/" class="ic-sitrep-link">
          <i class="pi pi-plus" aria-hidden="true" />
          Nieuwe melding
        </NuxtLink>
        <button
          type="button"
          class="ic-sitrep-refresh"
          :disabled="refreshing"
          @click="refresh"
        >
          <i class="pi pi-refresh" :class="{ 'pi-spin': refreshing }" aria-hidden="true" />
          Vernieuwen
        </button>
      </div>

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
        <SitrepKpiCards :summary="summary" :last-updated="lastUpdated" />

        <div class="ic-sitrep-split">
          <SitrepMainTabs :incidents="incidents" />
          <SitrepIncidentList :incidents="incidents" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ic-sitrep-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgb(135 161 198 / 0.25);
  background: var(--ic-surface);
}

.ic-sitrep-link,
.ic-sitrep-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.ic-sitrep-link {
  background: var(--ic-brand);
  color: #fff;
  text-decoration: none;
}

.ic-sitrep-link:hover {
  background: var(--ic-brand-dark);
}

.ic-sitrep-refresh {
  border: 1px solid rgb(135 161 198 / 0.55);
  background: #fff;
  color: var(--ic-brand);
}

.ic-sitrep-refresh:hover:not(:disabled) {
  background: rgb(135 161 198 / 0.12);
}

.ic-sitrep-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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
