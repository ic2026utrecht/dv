<script setup lang="ts">
import type { Incident, IncidentUpdate } from '~/types/models'
import { buildSitrepListEntries, type IncidentGroup } from '~/utils/incidentGrouping'
import { DEFAULT_SITREP_LIST_FILTERS } from '~/utils/sitrepFilters'
import { getHighestSeverity, getIncidentSeverity } from '~/utils/sitrepColors'

const props = withDefaults(defineProps<{
  /** Flat list mode: render these incidents instead of the filtered sitrep query list. */
  incidents?: Incident[]
  hideFilters?: boolean
  showSummary?: boolean
  emptyMessage?: string
  rowVariant?: 'standalone' | 'child' | 'orphan' | 'group'
}>(), {
  hideFilters: false,
  showSummary: true,
  emptyMessage: 'Geen incidenten voor dit filter',
  rowVariant: 'standalone',
})

const EXPANDED_STORAGE_KEY = 'sitrep-group-expanded'

const useEmbeddedList = computed(() => props.incidents != null)

const { incidents, updateIncident } = useSitrep()
const { filters, filterIncidents } = useSitrepQuery()
const { unreadCount } = useIncidentFeedUnread()
const { openEditIncident } = useSitrepEditIncident()

const filtersDrawerOpen = ref(false)

const statusIncident = ref<Incident | null>(null)
const statusDialogOpen = ref(false)
const statusSaving = ref(false)
const statusSaveError = ref<string | null>(null)

const expandedOverrides = ref<Record<string, boolean>>(loadExpandedOverrides())

const filteredIncidents = computed(() =>
  useEmbeddedList.value ? props.incidents! : filterIncidents(incidents.value),
)

const listEntries = computed(() => {
  if (useEmbeddedList.value) {
    return []
  }
  return buildSitrepListEntries(filteredIncidents.value, incidents.value, filters.value.sort)
})

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
  if (filters.value.search.trim()) {
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
    const id = statusIncident.value?.incidentId
    if (!id) {
      return
    }
    const fresh = list.find(incident => incident.incidentId === id)
    if (fresh) {
      statusIncident.value = fresh
    }
  },
)

function loadExpandedOverrides(): Record<string, boolean> {
  if (!import.meta.client) {
    return {}
  }
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
    )
  }
  catch {
    return {}
  }
}

function persistExpandedOverrides() {
  if (!import.meta.client) {
    return
  }
  localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(expandedOverrides.value))
}

function isGroupExpanded(group: IncidentGroup): boolean {
  const stored = expandedOverrides.value[group.parent.incidentId]
  if (typeof stored === 'boolean') {
    return stored
  }
  return group.children.some(child => child.isOpen)
}

function toggleGroup(group: IncidentGroup) {
  expandedOverrides.value = {
    ...expandedOverrides.value,
    [group.parent.incidentId]: !isGroupExpanded(group),
  }
  persistExpandedOverrides()
}

function groupUnreadCount(group: IncidentGroup): number {
  return unreadCount(group.parent.incidentId)
    + group.children.reduce((sum, child) => sum + unreadCount(child.incidentId), 0)
}

function groupSeverity(group: IncidentGroup) {
  return getHighestSeverity([
    getIncidentSeverity(group.parent),
    ...group.children.map(child => getIncidentSeverity(child)),
  ])
}

function openIncident(incident: Incident) {
  openEditIncident(incident)
}

function openStatusUpdate(incident: Incident) {
  statusIncident.value = incident
  statusSaveError.value = null
  statusDialogOpen.value = true
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
    <div v-if="!hideFilters" class="ic-sitrep-list__controls-bar">
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
      <span v-if="showSummary" class="ic-sitrep-list__summary">
        {{ filteredIncidents.length }} melding{{ filteredIncidents.length === 1 ? '' : 'en' }}
      </span>
    </div>

    <div v-if="!hideFilters" class="ic-sitrep-list__controls ic-sitrep-list__controls--desktop">
      <SitrepIncidentListFilters />
    </div>

    <Drawer
      v-if="!hideFilters"
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
        {{ emptyMessage }}
      </p>

      <ul v-else-if="useEmbeddedList" class="ic-sitrep-list__items">
        <li
          v-for="incident in filteredIncidents"
          :key="incident.incidentId"
        >
          <SitrepIncidentListRow
            :variant="rowVariant"
            :incident="incident"
            :unread-count="unreadCount(incident.incidentId)"
            @open="openIncident(incident)"
            @status="openStatusUpdate(incident)"
          />
        </li>
      </ul>

      <ul v-else class="ic-sitrep-list__items">
        <li
          v-for="entry in listEntries"
          :key="entry.kind === 'group' ? entry.group.parent.incidentId : entry.incident.incidentId"
        >
          <template v-if="entry.kind === 'group'">
            <SitrepIncidentListRow
              variant="group"
              :incident="entry.group.parent"
              :unread-count="groupUnreadCount(entry.group)"
              :child-count="entry.group.children.length"
              :expanded="isGroupExpanded(entry.group)"
              :severity="groupSeverity(entry.group)"
              @open="openIncident(entry.group.parent)"
              @status="openStatusUpdate(entry.group.parent)"
              @toggle="toggleGroup(entry.group)"
            />
            <ul
              v-show="isGroupExpanded(entry.group)"
              class="ic-sitrep-list__children"
            >
              <li
                v-for="child in entry.group.children"
                :key="child.incidentId"
              >
                <SitrepIncidentListRow
                  variant="child"
                  :incident="child"
                  :unread-count="unreadCount(child.incidentId)"
                  @open="openIncident(child)"
                  @status="openStatusUpdate(child)"
                />
              </li>
            </ul>
          </template>
          <SitrepIncidentListRow
            v-else-if="entry.kind === 'orphan'"
            variant="orphan"
            :incident="entry.incident"
            :unread-count="unreadCount(entry.incident.incidentId)"
            :parent-label="entry.parentLabel || entry.parentId"
            @open="openIncident(entry.incident)"
            @status="openStatusUpdate(entry.incident)"
          />
          <SitrepIncidentListRow
            v-else
            :incident="entry.incident"
            :unread-count="unreadCount(entry.incident.incidentId)"
            @open="openIncident(entry.incident)"
            @status="openStatusUpdate(entry.incident)"
          />
        </li>
      </ul>
    </div>

    <Message v-if="statusSaveError" severity="error" class="ic-sitrep-list__error">
      {{ statusSaveError }}
    </Message>

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

.ic-sitrep-list__children {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0 0 0 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border-left: 2px solid rgb(135 161 198 / 0.35);
  margin-left: 0.75rem;
}
</style>
