<script setup lang="ts">
import type { Incident, IncidentUpdate } from '~/types/models'
import { DEPARTMENTS, PRIORITIES } from '~/constants/incident'
import type { SitrepSortKey } from '~/utils/sitrepFilters'
import { getIncidentSeverity, severityDotClass, severityLabel, severityRowBtnClass } from '~/utils/sitrepColors'

const { incidents, updateIncident } = useSitrep()
const { filters, setFilter, filterIncidents } = useSitrepQuery()

const selectedIncident = ref<Incident | null>(null)
const editDialogOpen = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)

const filteredIncidents = computed(() => filterIncidents(incidents.value))

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

const departmentOptions = DEPARTMENTS.map(d => ({ value: d, label: d }))

const priorityOptions = PRIORITIES.map(p => ({ value: p, label: p }))

const statusOptions = [
  { value: 'open', label: 'Alleen open' },
  { value: 'Open', label: 'Open' },
  { value: 'In behandeling', label: 'In behandeling' },
  { value: 'Afgesloten', label: 'Afgesloten' },
]

const sortOptions: { value: SitrepSortKey, label: string }[] = [
  { value: 'priority', label: 'Prioriteit' },
  { value: 'newest', label: 'Nieuwste' },
  { value: 'oldest', label: 'Oudste' },
  { value: 'age', label: 'Langst open' },
]

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
</script>

<template>
  <section class="ic-sitrep-list ic-sitrep-list--panel">
    <div class="ic-sitrep-list__controls">
      <IcFormField label="Afdeling" html-for="sitrep-filter-department">
        <MultiSelect
          id="sitrep-filter-department"
          :model-value="filters.department"
          :options="departmentOptions"
          option-label="label"
          option-value="value"
          placeholder="Alle afdelingen"
          display="chip"
          class="ic-sitrep-list__filter"
          @update:model-value="setFilter('department', $event)"
        />
      </IcFormField>
      <IcFormField label="Prioriteit" html-for="sitrep-filter-priority">
        <MultiSelect
          id="sitrep-filter-priority"
          :model-value="filters.priority"
          :options="priorityOptions"
          option-label="label"
          option-value="value"
          placeholder="Alle prioriteiten"
          display="chip"
          class="ic-sitrep-list__filter"
          @update:model-value="setFilter('priority', $event)"
        />
      </IcFormField>
      <IcFormField label="Status" html-for="sitrep-filter-status">
        <MultiSelect
          id="sitrep-filter-status"
          :model-value="filters.status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          placeholder="Alle statussen"
          display="chip"
          class="ic-sitrep-list__filter"
          @update:model-value="setFilter('status', $event)"
        />
      </IcFormField>
      <IcFormField label="Sorteren" html-for="sitrep-filter-sort">
        <Select
          id="sitrep-filter-sort"
          :model-value="filters.sort"
          :options="sortOptions"
          option-label="label"
          option-value="value"
          class="ic-sitrep-list__filter"
          @update:model-value="setFilter('sort', $event)"
        />
      </IcFormField>
    </div>

    <div class="ic-sitrep-list__scroll">
      <p v-if="filteredIncidents.length === 0" class="ic-sitrep-list__empty">
        Geen incidenten voor dit filter
      </p>

      <ul v-else class="ic-sitrep-list__items">
        <li
          v-for="incident in filteredIncidents"
          :key="incident.incidentId"
        >
          <button
            type="button"
            :class="severityRowBtnClass(getIncidentSeverity(incident))"
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
        </li>
      </ul>
    </div>

    <Message v-if="saveError" severity="error" class="ic-sitrep-list__error">
      {{ saveError }}
    </Message>

    <SitrepIncidentEditDialog
      v-model="editDialogOpen"
      :incident="selectedIncident"
      :saving="saving"
      @save="handleSave"
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
</style>
