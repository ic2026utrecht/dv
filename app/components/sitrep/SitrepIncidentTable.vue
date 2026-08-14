<script setup lang="ts">
import type { Incident, IncidentUpdate } from '~/types/models'
import { getIncidentSeverity, severityDotClass, severityLabel } from '~/utils/sitrepColors'

const { incidents, updateIncident, lastUpdated, refreshing } = useSitrep()
const { filterIncidents } = useSitrepQuery()

const selectedIncident = ref<Incident | null>(null)
const statusIncident = ref<Incident | null>(null)
const editDialogOpen = ref(false)
const statusDialogOpen = ref(false)
const saving = ref(false)
const statusSaving = ref(false)
const saveError = ref<string | null>(null)
const statusSaveError = ref<string | null>(null)

const filteredIncidents = computed(() => filterIncidents(incidents.value))

const childCountByParent = computed(() => {
  const counts = new Map<string, number>()
  for (const incident of incidents.value) {
    const parentId = incident.parentId?.trim()
    if (!parentId) {
      continue
    }
    counts.set(parentId, (counts.get(parentId) ?? 0) + 1)
  }
  return counts
})

function groupingLabel(incident: Incident): string {
  const parentId = incident.parentId?.trim()
  if (parentId) {
    return parentId
  }
  const childCount = childCountByParent.value.get(incident.incidentId) ?? 0
  if (childCount > 0) {
    return `${childCount} sub`
  }
  return '—'
}

const lastUpdatedLabel = computed(() => {
  if (!lastUpdated.value) {
    return null
  }
  return lastUpdated.value.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
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

function openStatusUpdate(incident: Incident, event: Event) {
  event.stopPropagation()
  statusIncident.value = incident
  statusSaveError.value = null
  statusDialogOpen.value = true
}

function tableRowClass(incident: Incident): string {
  return `ic-sitrep-table__row--${getIncidentSeverity(incident)}`
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
  <section class="ic-sitrep-table">
    <div class="ic-sitrep-table__toolbar">
      <div class="ic-sitrep-table__filters">
        <SitrepIncidentListFilters id-prefix="table-" />
      </div>
      <div class="ic-sitrep-table__meta">
        <span class="ic-sitrep-table__count">
          {{ filteredIncidents.length }} melding{{ filteredIncidents.length === 1 ? '' : 'en' }}
        </span>
        <span
          v-if="lastUpdatedLabel"
          class="ic-sitrep-table__refresh"
          :class="{ 'ic-sitrep-table__refresh--active': refreshing }"
        >
          <i class="pi pi-sync" aria-hidden="true" />
          {{ refreshing ? 'Vernieuwen…' : `Bijgewerkt ${lastUpdatedLabel}` }}
          · auto elke minuut
        </span>
      </div>
    </div>

    <div class="ic-sitrep-table__scroll">
      <p v-if="filteredIncidents.length === 0" class="ic-sitrep-table__empty">
        Geen incidenten voor dit filter
      </p>

      <table v-else class="ic-sitrep-table__grid">
        <colgroup>
          <col class="ic-sitrep-table__col-id">
          <col class="ic-sitrep-table__col-group">
          <col class="ic-sitrep-table__col-priority">
          <col class="ic-sitrep-table__col-dept">
          <col class="ic-sitrep-table__col-type">
          <col class="ic-sitrep-table__col-location">
          <col class="ic-sitrep-table__col-sector">
          <col class="ic-sitrep-table__col-status">
          <col class="ic-sitrep-table__col-time">
          <col class="ic-sitrep-table__col-open">
          <col class="ic-sitrep-table__col-owner">
          <col class="ic-sitrep-table__col-reporter">
          <col class="ic-sitrep-table__col-desc">
          <col class="ic-sitrep-table__col-actions">
        </colgroup>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Hoofd</th>
            <th scope="col">Prioriteit</th>
            <th scope="col">Afdeling</th>
            <th scope="col">Type</th>
            <th scope="col">Locatie</th>
            <th scope="col">Sector</th>
            <th scope="col">Status</th>
            <th scope="col">Tijd</th>
            <th scope="col">Open</th>
            <th scope="col">Actiehouder</th>
            <th scope="col">Melder</th>
            <th scope="col">Omschrijving</th>
            <th scope="col" class="ic-sitrep-table__actions-head" aria-label="Acties" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="incident in filteredIncidents"
            :key="incident.incidentId"
            :class="['ic-sitrep-table__row', tableRowClass(incident)]"
            tabindex="0"
            role="button"
            @click="openIncident(incident)"
            @keydown.enter="openIncident(incident)"
            @keydown.space.prevent="openIncident(incident)"
          >
            <td class="ic-sitrep-table__id">
              {{ incident.incidentId }}
            </td>
            <td class="ic-sitrep-table__group">
              {{ groupingLabel(incident) }}
            </td>
            <td>
              <span class="ic-sitrep-table__priority">
                <span :class="severityDotClass(getIncidentSeverity(incident))" aria-hidden="true" />
                {{ severityLabel(getIncidentSeverity(incident)) }}
              </span>
            </td>
            <td>{{ incident.department }}</td>
            <td>{{ incident.incidentTypeName }}</td>
            <td>{{ incident.locationName }}</td>
            <td>{{ incident.sector || '—' }}</td>
            <td>{{ incident.status || 'Open' }}</td>
            <td class="ic-sitrep-table__nowrap">
              {{ formatTime(incident.timestamp) }}
            </td>
            <td class="ic-sitrep-table__nowrap">
              {{ incident.isOpen ? formatAge(incident.ageMinutes) : '—' }}
            </td>
            <td>{{ incident.actionOwner || '—' }}</td>
            <td>{{ incident.reporter || '—' }}</td>
            <td class="ic-sitrep-table__desc">
              {{ incident.description || '—' }}
            </td>
            <td class="ic-sitrep-table__actions">
              <button
                type="button"
                class="ic-sitrep-table__status-btn"
                :title="statusButtonLabel(incident.status || 'Open')"
                :aria-label="statusButtonLabel(incident.status || 'Open')"
                @click="openStatusUpdate(incident, $event)"
              >
                <i class="pi pi-flag" aria-hidden="true" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Message
      v-if="saveError || statusSaveError"
      severity="error"
      class="ic-sitrep-table__error"
    >
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
.ic-sitrep-table {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.ic-sitrep-table__toolbar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgb(135 161 198 / 0.25);
  background: var(--ic-surface);
}

.ic-sitrep-table__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  justify-content: space-between;
}

.ic-sitrep-table__count {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
}

.ic-sitrep-table__refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #64748b;
}

.ic-sitrep-table__refresh--active .pi-sync {
  animation: ic-sitrep-spin 0.8s linear infinite;
}

@keyframes ic-sitrep-spin {
  to {
    transform: rotate(360deg);
  }
}

.ic-sitrep-table__scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
}

.ic-sitrep-table__empty {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: #64748b;
}

.ic-sitrep-table__grid {
  width: 100%;
  min-width: 80rem;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.8125rem;
}

.ic-sitrep-table__grid thead tr {
  display: table-row;
}

.ic-sitrep-table__grid tbody tr {
  display: table-row;
}

.ic-sitrep-table__col-id { width: 7.5rem; }
.ic-sitrep-table__col-group { width: 7.5rem; }
.ic-sitrep-table__col-priority { width: 6.5rem; }
.ic-sitrep-table__col-dept { width: 7rem; }
.ic-sitrep-table__col-type { width: 11rem; }
.ic-sitrep-table__col-location { width: 9rem; }
.ic-sitrep-table__col-sector { width: 4rem; }
.ic-sitrep-table__col-status { width: 7rem; }
.ic-sitrep-table__col-time { width: 6.5rem; }
.ic-sitrep-table__col-open { width: 5rem; }
.ic-sitrep-table__col-owner { width: 7rem; }
.ic-sitrep-table__col-reporter { width: 7rem; }
.ic-sitrep-table__col-desc { width: auto; }
.ic-sitrep-table__col-actions { width: 2.75rem; }

.ic-sitrep-table__grid thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fafc;
  box-shadow: inset 0 -1px 0 rgb(135 161 198 / 0.35);
}

.ic-sitrep-table__grid th {
  padding: 0.625rem 0.75rem;
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #64748b;
  white-space: nowrap;
}

.ic-sitrep-table__grid td {
  padding: 0.625rem 0.75rem;
  vertical-align: top;
  border-bottom: 1px solid rgb(135 161 198 / 0.18);
  color: var(--ic-brand-dark);
}

.ic-sitrep-table__row {
  cursor: pointer;
  transition: background 0.12s ease;
}

.ic-sitrep-table__row td:first-child {
  box-shadow: inset 4px 0 0 transparent;
}

.ic-sitrep-table__row--critical {
  background: rgb(153 27 27 / 0.04);
}

.ic-sitrep-table__row--critical td:first-child {
  box-shadow: inset 4px 0 0 var(--ic-critical);
}

.ic-sitrep-table__row--high {
  background: rgb(239 68 68 / 0.04);
}

.ic-sitrep-table__row--high td:first-child {
  box-shadow: inset 4px 0 0 var(--ic-high);
}

.ic-sitrep-table__row--warning {
  background: rgb(230 151 50 / 0.06);
}

.ic-sitrep-table__row--warning td:first-child {
  box-shadow: inset 4px 0 0 var(--ic-orange);
}

.ic-sitrep-table__row--ok {
  background: rgb(34 197 94 / 0.04);
}

.ic-sitrep-table__row--ok td:first-child {
  box-shadow: inset 4px 0 0 #22c55e;
}

.ic-sitrep-table__row--closed {
  background: rgb(148 163 184 / 0.06);
}

.ic-sitrep-table__row--closed td:first-child {
  box-shadow: inset 4px 0 0 #94a3b8;
}

.ic-sitrep-table__row:hover,
.ic-sitrep-table__row:focus-visible {
  outline: none;
  background: rgb(45 46 126 / 0.04);
}

.ic-sitrep-table__row:hover td,
.ic-sitrep-table__row:focus-visible td {
  background: rgb(45 46 126 / 0.04);
}

.ic-sitrep-table__id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.ic-sitrep-table__group {
  font-size: 0.75rem;
  white-space: nowrap;
  color: #475569;
}

.ic-sitrep-table__priority {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  white-space: nowrap;
}

.ic-sitrep-table__nowrap {
  white-space: nowrap;
}

.ic-sitrep-table__desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ic-sitrep-table__actions-head,
.ic-sitrep-table__actions {
  width: 2.75rem;
  text-align: center;
}

.ic-sitrep-table__status-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border: 1px solid rgb(135 161 198 / 0.45);
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 0.85);
  color: var(--ic-brand-dark);
  cursor: pointer;
}

.ic-sitrep-table__status-btn:hover {
  border-color: var(--ic-brand);
  color: var(--ic-brand);
  background: #fff;
}

.ic-sitrep-table__error {
  flex-shrink: 0;
  margin: 0.75rem 1rem;
}

@media (max-width: 900px) {
  .ic-sitrep-table {
    height: auto;
    min-height: 24rem;
  }
}
</style>
