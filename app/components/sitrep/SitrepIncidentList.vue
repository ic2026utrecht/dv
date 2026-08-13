<script setup lang="ts">
import type { Incident, IncidentUpdate } from '~/types/models'
import { DEFAULT_SITREP_LIST_FILTERS } from '~/utils/sitrepFilters'
import { getIncidentSeverity, severityDotClass, severityLabel, severityRowBtnClass } from '~/utils/sitrepColors'

const { incidents, updateIncident } = useSitrep()
const { filters, filterIncidents } = useSitrepQuery()

const filtersDrawerOpen = ref(false)

const selectedIncident = ref<Incident | null>(null)
const statusIncident = ref<Incident | null>(null)
const editDialogOpen = ref(false)
const statusDialogOpen = ref(false)
const saving = ref(false)
const statusSaving = ref(false)
const saveError = ref<string | null>(null)
const statusSaveError = ref<string | null>(null)

const filteredIncidents = computed(() => filterIncidents(incidents.value))

const activeFilterCount = computed(() => {
  let count = 0
  if (filters.value.department.length > 0) {
    count++
  }
  if (filters.value.priority.length > 0) {
    count++
  }
  if (filters.value.location.length > 0) {
    count++
  }
  if (
    filters.value.status.length !== DEFAULT_SITREP_LIST_FILTERS.status.length
    || filters.value.status.some((value, index) => value !== DEFAULT_SITREP_LIST_FILTERS.status[index])
  ) {
    count++
  }
  if (filters.value.sort !== DEFAULT_SITREP_LIST_FILTERS.sort) {
    count++
  }
  return count
})

watch(
  () => incidents.value,
  (list) => {
    const id = selectedIncident.value?.incidentId
    if (!id) {
      return
    }
    const fresh = list.find(incident => incident.incidentId === id)
    if (fresh) {
      selectedIncident.value = fresh
    }
  },
)

function formatAge(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}u ${mins}m` : `${hours}u`
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return timestamp
  }
  return date.toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function openIncident(incident: Incident) {
  selectedIncident.value = incident
  saveError.value = null
  editDialogOpen.value = true
}

function openStatusUpdate(incident: Incident) {
  statusIncident.value = incident
  statusSaveError.value = null
  statusDialogOpen.value = true
}

function statusIcon(status: string): string {
  return 'pi-flag'
}

function statusButtonLabel(status: string): string {
  switch (status) {
    case 'Open':
      return 'Status: Open — klik om bij te werken'
    case 'In behandeling':
      return 'Status: In behandeling — klik om bij te werken'
    case 'Afgesloten':
      return 'Status: Afgesloten — klik om bij te werken'
    default:
      return 'Status wijzigen'
  }
}

async function handleSave(payload: IncidentUpdate) {
  saving.value = true
  saveError.value = null

  try {
    await updateIncident(payload)
    editDialogOpen.value = false
    selectedIncident.value = null
  }
  catch (err: unknown) {
    saveError.value = err instanceof Error ? err.message : 'Opslaan mislukt'
  }
  finally {
    saving.value = false
  }
}

async function handleStatusSave(payload: IncidentUpdate) {
  statusSaving.value = true
  statusSaveError.value = null

  try {
    await updateIncident(payload)
    statusDialogOpen.value = false
    statusIncident.value = null
  }
  catch (err: unknown) {
    statusSaveError.value = err instanceof Error ? err.message : 'Status bijwerken mislukt'
  }
  finally {
    statusSaving.value = false
  }
}
</script>

<template>
  <section class="ic-sitrep-list ic-sitrep-list--panel">
    <div class="ic-sitrep-list__controls-bar">
      <button
        type="button"
        class="ic-sitrep-list__filters-btn"
        :class="{ 'ic-sitrep-list__filters-btn--active': activeFilterCount > 0 }"
        aria-label="Filters en sorteren"
        @click="filtersDrawerOpen = true"
      >
        <i class="pi pi-sliders-h" aria-hidden="true" />
        <span
          v-if="activeFilterCount > 0"
          class="ic-sitrep-list__filters-badge"
        >
          {{ activeFilterCount }}
        </span>
      </button>
      <span class="ic-sitrep-list__summary">
        {{ filteredIncidents.length }} melding{{ filteredIncidents.length === 1 ? '' : 'en' }}
      </span>
    </div>

    <div class="ic-sitrep-list__controls ic-sitrep-list__controls--desktop">
      <SitrepIncidentListFilters />
    </div>

    <Drawer
      v-model:visible="filtersDrawerOpen"
      position="bottom"
      header="Filters & sorteren"
      class="ic-sitrep-list-filters-drawer"
      :block-scroll="true"
      :dismissable-mask="true"
    >
      <SitrepIncidentListFilters v-if="filtersDrawerOpen" id-prefix="mobile-" />
      <div class="ic-sitrep-list-filters-drawer__actions">
        <Button
          label="Klaar"
          class="w-full"
          @click="filtersDrawerOpen = false"
        />
      </div>
    </Drawer>

    <div class="ic-sitrep-list__scroll">
      <p v-if="filteredIncidents.length === 0" class="ic-sitrep-list__empty">
        Geen incidenten voor dit filter
      </p>

      <ul v-else class="ic-sitrep-list__items">
        <li
          v-for="incident in filteredIncidents"
          :key="incident.incidentId"
        >
          <div :class="['ic-sitrep-list__row', severityRowBtnClass(getIncidentSeverity(incident))]">
            <button
              type="button"
              class="ic-sitrep-list__open"
              @click="openIncident(incident)"
            >
              <span :class="severityDotClass(getIncidentSeverity(incident))" aria-hidden="true" />
              <div class="ic-sitrep-list__body">
                <div class="ic-sitrep-list__top">
                  <span class="ic-sitrep-list__id">{{ incident.incidentId }}</span>
                  <span class="ic-sitrep-list__badge">{{ severityLabel(getIncidentSeverity(incident)) }}</span>
                </div>
                <p class="ic-sitrep-list__type">
                  {{ incident.incidentTypeName }} · {{ incident.department }}
                </p>
                <p class="ic-sitrep-list__location">
                  {{ incident.locationName }}
                  <span v-if="incident.sector"> · {{ incident.sector }}</span>
                </p>
                <p v-if="incident.description" class="ic-sitrep-list__desc">
                  {{ incident.description }}
                </p>
                <div class="ic-sitrep-list__meta">
                  <span>{{ formatTime(incident.timestamp) }}</span>
                  <span v-if="incident.isOpen">{{ formatAge(incident.ageMinutes) }} open</span>
                  <span v-if="incident.actionOwner">Actie: {{ incident.actionOwner }}</span>
                  <span>{{ incident.status || 'Open' }}</span>
                </div>
              </div>
              <i class="pi pi-chevron-right ic-sitrep-row-btn__icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              :class="[
                'ic-sitrep-list__status-btn',
                `ic-sitrep-list__status-btn--${(incident.status || 'Open').toLowerCase().replace(/\s+/g, '-')}`
              ]"
              :title="statusButtonLabel(incident.status || 'Open')"
              :aria-label="statusButtonLabel(incident.status || 'Open')"
              @click="openStatusUpdate(incident)"
            >
              <i :class="['pi', statusIcon(incident.status || 'Open')]" aria-hidden="true" />
            </button>
          </div>
        </li>
      </ul>
    </div>

    <Message v-if="saveError || statusSaveError" severity="error" class="ic-sitrep-list__error">
      {{ saveError || statusSaveError }}
    </Message>

    <SitrepIncidentEditDialog
      v-model="editDialogOpen"
      :incident="selectedIncident"
      :saving="saving"
      @save="handleSave"
    />

    <SitrepIncidentStatusDialog
      v-model="statusDialogOpen"
      :incident="statusIncident"
      :saving="statusSaving"
      @save="handleStatusSave"
    />
  </section>
</template>

<style scoped>
.ic-sitrep-list--panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
}

.ic-sitrep-list__controls {
  flex-shrink: 0;
}

.ic-sitrep-list__controls-bar {
  display: none;
}

.ic-sitrep-list__filters-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  border: 1px solid rgb(135 161 198 / 0.45);
  border-radius: 0.5rem;
  background: #fff;
  color: var(--ic-brand-dark);
  font-size: 0.9375rem;
  cursor: pointer;
}

.ic-sitrep-list__filters-btn--active {
  border-color: var(--ic-orange);
  color: var(--ic-brand);
  background: rgb(230 151 50 / 0.08);
}

.ic-sitrep-list__filters-badge {
  position: absolute;
  top: -0.3125rem;
  right: -0.3125rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1rem;
  height: 1rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  background: var(--ic-orange);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1;
}

.ic-sitrep-list__summary {
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
}

@media (max-width: 900px) {
  .ic-sitrep-list--panel {
    height: auto;
    max-height: none;
    min-height: 0;
    overflow: visible;
  }

  .ic-sitrep-list__scroll {
    flex: none;
    min-height: auto;
    overflow: visible;
  }
}

@media (max-width: 900px) {
  .ic-sitrep-list__controls-bar {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-shrink: 0;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid rgb(135 161 198 / 0.2);
    background: var(--ic-surface);
  }

  .ic-sitrep-list__controls--desktop {
    display: none;
  }
}

@media (min-width: 901px) {
  .ic-sitrep-list-filters-drawer {
    display: none;
  }
}

.ic-sitrep-list__scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.ic-sitrep-list__error {
  flex-shrink: 0;
}

.ic-sitrep-list__row {
  display: flex;
  align-items: stretch;
  gap: 0.375rem;
}

.ic-sitrep-list__row.ic-sitrep-row-btn {
  padding: 0;
  gap: 0;
}

.ic-sitrep-list__open {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 0.75rem;
  padding: 0.75rem;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.ic-sitrep-list__row:hover .ic-sitrep-list__open {
  box-shadow: none;
}

.ic-sitrep-list__row:hover {
  box-shadow: inset 0 0 0 1px rgb(45 46 126 / 0.12);
}

.ic-sitrep-list__open:focus-visible {
  outline: 2px solid var(--ic-brand);
  outline-offset: 2px;
}

.ic-sitrep-list__status-btn {
  flex-shrink: 0;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  margin-right: 0.375rem;
  border: 1px solid rgb(135 161 198 / 0.45);
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 0.85);
  color: var(--ic-brand-dark);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.ic-sitrep-list__status-btn:hover {
  background: #fff;
  border-color: var(--ic-brand);
  color: var(--ic-brand);
}

.ic-sitrep-list__status-btn:focus-visible {
  outline: 2px solid var(--ic-brand);
  outline-offset: 2px;
}

.ic-sitrep-list__status-btn--open {
  color: #f97316;
  border-color: rgb(249 115 22 / 0.3);
}

.ic-sitrep-list__status-btn--open:hover {
  background: rgb(249 115 22 / 0.08);
  border-color: #f97316;
  color: #c2410c;
}

.ic-sitrep-list__status-btn--in-behandeling {
  color: #22c55e;
  border-color: rgb(34 197 94 / 0.3);
}

.ic-sitrep-list__status-btn--in-behandeling:hover {
  background: rgb(34 197 94 / 0.08);
  border-color: #22c55e;
  color: #15803d;
}

.ic-sitrep-list__status-btn--afgesloten {
  color: #64748b;
  border-color: rgb(148 163 184 / 0.3);
}

.ic-sitrep-list__status-btn--afgesloten:hover {
  background: rgb(148 163 184 / 0.1);
  border-color: #64748b;
  color: #475569;
}
</style>
