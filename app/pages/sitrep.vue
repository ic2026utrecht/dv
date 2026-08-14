<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

useHead({
  title: 'Sitrep — IC2026 Dienstverlening',
})

const {
  loading,
  refreshing,
  error,
  lastUpdated,
  summary,
  fetchIncidents,
  refreshIncidents,
  startPolling,
  stopPolling,
} = useSitrep()

const { loadUnreadCounts } = useIncidentFeedUnread()

const { fetchConfig } = useIncidents()
const apiConfig = ref<Awaited<ReturnType<typeof fetchConfig>> | null>(null)
const canUpdateIncidents = computed(() => supportsIncidentUpdate(apiConfig.value))

const createDialogOpen = ref(false)

onMounted(() => {
  fetchConfig()
    .then((config) => {
      apiConfig.value = config
    })
    .catch(() => {})

  fetchIncidents().catch(() => {})
  startPolling()
})

watch(lastUpdated, () => {
  loadUnreadCounts().catch(() => {})
}, { immediate: true })

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
      <PageHeader
        title="Sitrep dashboard"
        subtitle="Live overzicht van open incidenten op de congreslocatie"
      />

      <div class="ic-sitrep-body">
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

        <SitrepKpiCards
          :summary="summary"
          :last-updated="lastUpdated"
          :loading="loading"
          :refreshing="refreshing"
          @create="createDialogOpen = true"
          @refresh="refresh"
        />

        <SitrepMainTabs />
      </div>
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

@media (max-width: 900px) {
  .ic-sitrep-error {
    margin: 0.5rem 0.75rem;
  }
}
</style>
