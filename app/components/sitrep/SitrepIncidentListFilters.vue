<script setup lang="ts">
import { DEPARTMENTS, PRIORITIES } from '~/constants/incident'
import { DEFAULT_SITREP_LIST_FILTERS, type SitrepSortKey } from '~/utils/sitrepFilters'

const SEARCH_DEBOUNCE_MS = 300
const DESKTOP_MQ = '(min-width: 901px)'

const props = withDefaults(defineProps<{
  idPrefix?: string
  showSort?: boolean
}>(), {
  idPrefix: '',
  showSort: true,
})

const { filters, setFilter } = useSitrepQuery()
const { config, fetchConfig } = useIncidents()

const fieldId = (name: string) => `${props.idPrefix}${name}`
const filtersExpanded = ref(false)
const isDesktop = ref(false)

const departmentOptions = DEPARTMENTS.map(d => ({ value: d, label: d }))
const priorityOptions = PRIORITIES.map(p => ({ value: p, label: p }))

const locationOptions = computed(() =>
  (config.value?.locations ?? [])
    .filter(location => location.active)
    .map(location => ({ value: location.id, label: location.name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'nl')),
)

const advancedFilterCount = computed(() => {
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

const showAdvancedFilters = computed(() => !isDesktop.value || filtersExpanded.value)

const searchInput = ref(filters.value.search)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => filters.value.search,
  (value) => {
    if (value !== searchInput.value) {
      searchInput.value = value
    }
  },
)

watch(searchInput, (value) => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    const next = value.trim()
    if (next !== filters.value.search) {
      setFilter('search', next)
    }
  }, SEARCH_DEBOUNCE_MS)
})

function syncDesktopMq() {
  if (!import.meta.client) {
    return
  }
  isDesktop.value = window.matchMedia(DESKTOP_MQ).matches
  if (!isDesktop.value) {
    filtersExpanded.value = false
  }
}

let desktopMq: MediaQueryList | null = null
let onDesktopMqChange: (() => void) | null = null

onMounted(() => {
  if (!config.value) {
    fetchConfig().catch(() => {})
  }
  syncDesktopMq()
  if (import.meta.client) {
    desktopMq = window.matchMedia(DESKTOP_MQ)
    onDesktopMqChange = () => syncDesktopMq()
    desktopMq.addEventListener('change', onDesktopMqChange)
  }
})

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  if (desktopMq && onDesktopMqChange) {
    desktopMq.removeEventListener('change', onDesktopMqChange)
  }
})

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

function clearSearch() {
  searchInput.value = ''
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  if (filters.value.search) {
    setFilter('search', '')
  }
}

function toggleFilters() {
  filtersExpanded.value = !filtersExpanded.value
}
</script>

<template>
  <div
    class="ic-sitrep-list-filters"
    :class="{ 'ic-sitrep-list-filters--expanded': showAdvancedFilters }"
  >
    <div class="ic-sitrep-list-filters__toolbar">
      <IconField
        icon-position="right"
        class="ic-sitrep-list__filter ic-sitrep-list__filter--search"
      >
        <InputText
          :id="fieldId('sitrep-filter-search')"
          v-model="searchInput"
          type="search"
          placeholder="Zoek in incidenten en updates…"
          fluid
          autocomplete="off"
          aria-label="Zoeken"
        />
        <InputIcon
          v-if="searchInput"
          class="pi pi-times ic-sitrep-list-filters__clear"
          role="button"
          tabindex="0"
          aria-label="Zoekopdracht wissen"
          @click="clearSearch"
          @keydown.enter.prevent="clearSearch"
        />
        <InputIcon class="pi pi-search" />
      </IconField>

      <button
        type="button"
        class="ic-sitrep-list-filters__toggle"
        :class="{ 'ic-sitrep-list-filters__toggle--active': advancedFilterCount > 0 || filtersExpanded }"
        :aria-expanded="filtersExpanded"
        aria-controls="sitrep-advanced-filters"
        @click="toggleFilters"
      >
        <i class="pi pi-sliders-h" aria-hidden="true" />
        <span>Filters</span>
        <span
          v-if="advancedFilterCount > 0"
          class="ic-sitrep-list-filters__toggle-badge"
        >
          {{ advancedFilterCount }}
        </span>
        <i
          :class="['pi', filtersExpanded ? 'pi-chevron-up' : 'pi-chevron-down']"
          aria-hidden="true"
        />
      </button>
    </div>

    <div
      v-show="showAdvancedFilters"
      :id="fieldId('sitrep-advanced-filters')"
      class="ic-sitrep-list-filters__extra"
    >
      <IcFormField label="Afdeling" :html-for="fieldId('sitrep-filter-department')">
        <MultiSelect
          :id="fieldId('sitrep-filter-department')"
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
      <IcFormField label="Prioriteit" :html-for="fieldId('sitrep-filter-priority')">
        <MultiSelect
          :id="fieldId('sitrep-filter-priority')"
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
      <IcFormField label="Status" :html-for="fieldId('sitrep-filter-status')">
        <MultiSelect
          :id="fieldId('sitrep-filter-status')"
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
      <IcFormField label="Locatie" :html-for="fieldId('sitrep-filter-location')">
        <MultiSelect
          :id="fieldId('sitrep-filter-location')"
          :model-value="filters.location"
          :options="locationOptions"
          option-label="label"
          option-value="value"
          placeholder="Alle locaties"
          display="chip"
          filter
          class="ic-sitrep-list__filter"
          @update:model-value="setFilter('location', $event)"
        />
      </IcFormField>
      <IcFormField
        v-if="showSort"
        label="Sorteren"
        :html-for="fieldId('sitrep-filter-sort')"
      >
        <Select
          :id="fieldId('sitrep-filter-sort')"
          :model-value="filters.sort"
          :options="sortOptions"
          option-label="label"
          option-value="value"
          class="ic-sitrep-list__filter"
          @update:model-value="setFilter('sort', $event)"
        />
      </IcFormField>
    </div>
  </div>
</template>

<style scoped>
.ic-sitrep-list-filters {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  width: 100%;
}

.ic-sitrep-list-filters__toolbar {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
  width: 100%;
}

.ic-sitrep-list-filters__toolbar :deep(.ic-sitrep-list__filter--search) {
  flex: 1 1 auto;
  min-width: 0;
}

.ic-sitrep-list-filters__toggle {
  display: none;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  margin: 0;
  padding: 0 0.875rem;
  border: 1px solid rgb(135 161 198 / 0.45);
  border-radius: 0.5rem;
  background: #fff;
  color: var(--ic-brand-dark);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.ic-sitrep-list-filters__toggle:hover,
.ic-sitrep-list-filters__toggle:focus-visible {
  border-color: var(--ic-brand);
  color: var(--ic-brand);
  background: rgb(45 46 126 / 0.04);
  outline: none;
}

.ic-sitrep-list-filters__toggle--active {
  border-color: var(--ic-orange);
  color: var(--ic-brand);
  background: rgb(230 151 50 / 0.08);
}

.ic-sitrep-list-filters__toggle-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.3125rem;
  border-radius: 9999px;
  background: var(--ic-orange);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1;
}

.ic-sitrep-list-filters__extra {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.625rem;
}

.ic-sitrep-list-filters__extra :deep(.ic-field) {
  min-width: 0;
}

.ic-sitrep-list-filters__extra :deep(.ic-label) {
  margin-bottom: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #64748b;
}

.ic-sitrep-list-filters__clear {
  cursor: pointer;
}

.ic-sitrep-list-filters__clear:hover,
.ic-sitrep-list-filters__clear:focus-visible {
  color: var(--ic-brand);
  outline: none;
}

@media (min-width: 901px) {
  .ic-sitrep-list-filters {
    gap: 0.75rem;
  }

  .ic-sitrep-list-filters__toggle {
    display: inline-flex;
    min-height: 2.75rem;
  }

  .ic-sitrep-list-filters__extra {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .ic-sitrep-list-filters__extra :deep(.ic-label) {
    margin-bottom: 0.375rem;
    font-size: 0.8125rem;
    color: var(--ic-brand-dark);
  }

  .ic-sitrep-list-filters__extra :deep(.ic-sitrep-list__filter) {
    font-size: 0.9375rem;
  }

  .ic-sitrep-list-filters :deep(.p-select),
  .ic-sitrep-list-filters :deep(.p-multiselect),
  .ic-sitrep-list-filters :deep(.p-inputtext) {
    min-height: 2.75rem;
    font-size: 0.9375rem;
  }

  .ic-sitrep-list-filters :deep(.p-select-label),
  .ic-sitrep-list-filters :deep(.p-multiselect-label),
  .ic-sitrep-list-filters :deep(.p-inputtext) {
    padding: 0.625rem 0.875rem;
    font-size: 0.9375rem;
  }

  .ic-sitrep-list-filters :deep(.p-chip) {
    font-size: 0.8125rem;
  }
}
</style>
