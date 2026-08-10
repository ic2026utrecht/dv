<script setup lang="ts">
import type { Incident } from '~/types/models'
import type { SitrepView } from '~/utils/sitrepFilters'

const props = defineProps<{
  incidents: Incident[]
}>()

const { view, setView, filterIncidents } = useSitrepQuery()

const activeTab = computed({
  get: () => view.value,
  set: (value: SitrepView) => setView(value),
})

const filteredIncidents = computed(() => filterIncidents(props.incidents))
</script>

<template>
  <div class="ic-sitrep-main-tabs">
    <Tabs v-model:value="activeTab" class="ic-sitrep-tabs">
      <TabList>
        <Tab value="map">
          <i class="pi pi-map mr-1.5" aria-hidden="true" />
          Kaart
          <span class="ic-sitrep-tabs__badge">{{ filteredIncidents.length }}</span>
        </Tab>
        <Tab value="timeline">
          <i class="pi pi-history mr-1.5" aria-hidden="true" />
          Tijdlijn
          <span class="ic-sitrep-tabs__badge">{{ filteredIncidents.length }}</span>
        </Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="map">
          <SitrepMap :incidents="incidents" />
        </TabPanel>
        <TabPanel value="timeline">
          <SitrepTimeline :incidents="filteredIncidents" embedded />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.ic-sitrep-main-tabs {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.ic-sitrep-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ic-sitrep-tabs :deep(.p-tablist) {
  flex-shrink: 0;
  padding: 0 1rem;
  background: var(--ic-surface);
  border-bottom: 1px solid rgb(135 161 198 / 0.25);
}

.ic-sitrep-tabs :deep(.p-tablist-tab-list) {
  gap: 0.25rem;
}

.ic-sitrep-tabs :deep(.p-tab) {
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
  border-bottom: 2px solid transparent;
}

.ic-sitrep-tabs :deep(.p-tab.p-tab-active) {
  color: var(--ic-brand-dark);
  border-bottom-color: var(--ic-orange);
}

.ic-sitrep-tabs :deep(.p-tabpanels) {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

.ic-sitrep-tabs :deep(.p-tabpanel) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ic-sitrep-tabs__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  margin-left: 0.375rem;
  padding: 0 0.3125rem;
  border-radius: 9999px;
  background: rgb(45 46 126 / 0.12);
  color: var(--ic-brand);
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1;
}

.ic-sitrep-tabs :deep(.p-tab.p-tab-active) .ic-sitrep-tabs__badge {
  background: var(--ic-brand);
  color: #fff;
}
</style>
