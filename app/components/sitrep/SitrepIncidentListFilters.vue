<script setup lang="ts">
import { DEPARTMENTS, PRIORITIES } from '~/constants/incident'
import type { SitrepSortKey } from '~/utils/sitrepFilters'

const props = withDefaults(defineProps<{
  idPrefix?: string
}>(), {
  idPrefix: '',
})

const { filters, setFilter } = useSitrepQuery()

const fieldId = (name: string) => `${props.idPrefix}${name}`

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
</script>

<template>
  <div class="ic-sitrep-list-filters">
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
    <IcFormField label="Sorteren" :html-for="fieldId('sitrep-filter-sort')">
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
</template>

<style scoped>
.ic-sitrep-list-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 0.375rem;
}

.ic-sitrep-list-filters :deep(.ic-field) {
  min-width: 0;
}

.ic-sitrep-list-filters :deep(.ic-label) {
  margin-bottom: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #64748b;
}

@media (max-width: 900px) {
  .ic-sitrep-list-filters {
    grid-template-columns: 1fr;
    gap: 0.625rem;
  }
}
</style>
