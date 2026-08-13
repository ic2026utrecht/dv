<script setup lang="ts">
import type { SitrepView } from '~/utils/sitrepFilters'

const { incidents } = useSitrep()
const { view, setView, filterIncidents } = useSitrepQuery()

const activeTab = computed({
  get: () => view.value,
  set: (value: SitrepView) => setView(value),
})

const filteredIncidents = computed(() => filterIncidents(incidents.value))
const openCount = computed(() => incidents.value.filter(i => i.isOpen).length)
const mapDrawerOpen = ref(false)

const mapIncidentCount = computed(() =>
  filteredIncidents.value.filter(incident => incident.sector).length,
)
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
        <Tab value="analytics">
          <i class="pi pi-chart-bar mr-1.5" aria-hidden="true" />
          Statistieken
          <span class="ic-sitrep-tabs__badge">{{ openCount }}</span>
        </Tab>
      </TabList>
      <TabPanels :lazy="false">
        <TabPanel value="map">
          <div class="ic-sitrep-split">
            <button
              type="button"
              class="ic-sitrep-map-trigger"
              aria-haspopup="dialog"
              :aria-expanded="mapDrawerOpen"
              @click="mapDrawerOpen = true"
            >
              <span class="ic-sitrep-map-trigger__icon" aria-hidden="true">
                <i class="pi pi-map" />
              </span>
              <span class="ic-sitrep-map-trigger__copy">
                <span class="ic-sitrep-map-trigger__title">Kaartoverzicht</span>
                <span class="ic-sitrep-map-trigger__meta">
                  {{ mapIncidentCount }} op kaart
                  <span v-if="mapIncidentCount !== filteredIncidents.length">
                    · {{ filteredIncidents.length }} totaal
                  </span>
                </span>
              </span>
              <span class="ic-sitrep-map-trigger__action">
                Openen
                <i class="pi pi-arrow-up" aria-hidden="true" />
              </span>
            </button>

            <SitrepMap class="ic-sitrep-split__map-inline" :incidents="incidents" />
            <SitrepIncidentList />
          </div>

          <Drawer
            v-model:visible="mapDrawerOpen"
            position="bottom"
            header="Kaartoverzicht"
            class="ic-sitrep-map-drawer"
            :block-scroll="true"
            :dismissable-mask="true"
          >
            <p class="ic-sitrep-map-drawer__hint">
              Knijp om te zoomen · sleep om te verschuiven
            </p>
            <SitrepMap v-if="mapDrawerOpen" :incidents="incidents" />
          </Drawer>
        </TabPanel>
        <TabPanel value="timeline">
          <SitrepTimeline :incidents="filteredIncidents" embedded />
        </TabPanel>
        <TabPanel value="analytics">
          <ClientOnly>
            <SitrepAnalyticsDashboard />
            <template #fallback>
              <div class="ic-sitrep-analytics-fallback">
                <ProgressSpinner style="width: 2rem; height: 2rem" />
                <p>Statistieken laden…</p>
              </div>
            </template>
          </ClientOnly>
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

.ic-sitrep-tabs :deep(.p-tabpanel:has(.ic-sitrep-split)) {
  overflow: hidden;
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

.ic-sitrep-analytics-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  height: 100%;
  min-height: 12rem;
  color: var(--ic-brand);
  font-size: 0.8125rem;
}

.ic-sitrep-map-trigger {
  display: none;
}

@media (max-width: 900px) {
  .ic-sitrep-split__map-inline {
    display: none;
  }

  .ic-sitrep-map-trigger {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    flex-shrink: 0;
    margin: 0;
    padding: 0.75rem 1rem;
    border: none;
    border-bottom: 1px solid rgb(135 161 198 / 0.25);
    background:
      linear-gradient(135deg, rgb(45 46 126 / 0.06), rgb(230 151 50 / 0.08)),
      var(--ic-surface);
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .ic-sitrep-map-trigger:hover,
  .ic-sitrep-map-trigger:focus-visible {
    background:
      linear-gradient(135deg, rgb(45 46 126 / 0.1), rgb(230 151 50 / 0.12)),
      var(--ic-surface);
    outline: none;
  }

  .ic-sitrep-map-trigger__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.625rem;
    background: var(--ic-brand);
    color: #fff;
    font-size: 1rem;
  }

  .ic-sitrep-map-trigger__copy {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
    flex: 1 1 auto;
  }

  .ic-sitrep-map-trigger__title {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--ic-brand-dark);
  }

  .ic-sitrep-map-trigger__meta {
    font-size: 0.6875rem;
    color: #64748b;
  }

  .ic-sitrep-map-trigger__action {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
    padding: 0.375rem 0.625rem;
    border-radius: 9999px;
    background: #fff;
    border: 1px solid rgb(135 161 198 / 0.35);
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--ic-brand);
  }
}
</style>
