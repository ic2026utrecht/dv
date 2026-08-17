<script setup lang="ts">
import { PRIORITIES } from '~/constants/incident'
import type { Priority } from '~/types/models'
import {
  matchesIncidentExportFilters,
  parseIncidentNumberInput,
  type IncidentExportFilters,
} from '~/utils/incidentExport'

useHead({ title: 'Export — Admin — IC2026 DV' })

const { listIncidentIndex, exportIncidents } = useAdminIncidentExport()
const { fetchMe } = useStaffAuth()

const numberFromInput = ref('')
const numberToInput = ref('')
const priorities = ref<Priority[]>([])

const indexRows = ref<Array<{ incident_id: string, priority: Priority }>>([])
const loading = ref(true)
const exporting = ref<'csv' | 'json' | null>(null)
const error = ref<string | null>(null)
const lastExport = ref<{ format: 'csv' | 'json', count: number } | null>(null)

const priorityOptions = PRIORITIES.map(priority => ({
  value: priority,
  label: priority,
}))

const parsedFrom = computed(() => parseIncidentNumberInput(numberFromInput.value))
const parsedTo = computed(() => parseIncidentNumberInput(numberToInput.value))

const filterError = computed(() => {
  if (!parsedFrom.value.ok) {
    return `Van: ${parsedFrom.value.message}`
  }
  if (!parsedTo.value.ok) {
    return `Tot: ${parsedTo.value.message}`
  }
  if (
    parsedFrom.value.value != null
    && parsedTo.value.value != null
    && parsedFrom.value.value > parsedTo.value.value
  ) {
    return 'Het beginnummer mag niet hoger zijn dan het eindnummer'
  }
  return null
})

const filters = computed((): IncidentExportFilters | null => {
  if (filterError.value || !parsedFrom.value.ok || !parsedTo.value.ok) {
    return null
  }
  return {
    numberFrom: parsedFrom.value.value,
    numberTo: parsedTo.value.value,
    priorities: priorities.value,
  }
})

const matchCount = computed(() => {
  const current = filters.value
  if (!current) {
    return 0
  }
  return indexRows.value.filter(row =>
    matchesIncidentExportFilters(row.incident_id, row.priority, current),
  ).length
})

async function load() {
  loading.value = true
  error.value = null
  try {
    await fetchMe(true)
    indexRows.value = await listIncidentIndex()
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Laden mislukt'
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  load().catch(() => {})
})

async function onExport(format: 'csv' | 'json') {
  const current = filters.value
  if (!current) {
    return
  }

  exporting.value = format
  error.value = null
  lastExport.value = null
  try {
    const count = await exportIncidents(current, format)
    lastExport.value = { format, count }
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Export mislukt'
  }
  finally {
    exporting.value = null
  }
}
</script>

<template>
  <div class="space-y-6 p-5 sm:p-6">
    <Message
      v-if="error"
      severity="error"
      :closable="false"
    >
      {{ error }}
    </Message>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="ic-section-heading mb-0">
          Incidenten exporteren
        </h2>
        <Button
          icon="pi pi-refresh"
          severity="secondary"
          text
          rounded
          :loading="loading"
          aria-label="Vernieuwen"
          @click="load"
        />
      </div>
      <p class="text-sm text-slate-600">
        CSV bevat een platte incidenttabel. JSON bevat dezelfde incidenten plus alle
        gerelateerde tabellen (locaties, types, hulpopties, updates, statushistorie,
        WhatsApp) voor AI-input en analyse.
      </p>
    </section>

    <form
      class="ic-form ic-card space-y-4"
      @submit.prevent
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <IcFormField
          label="Incidentnummer van"
          hint="Nummer of INC-2026-001. Leeg = geen ondergrens."
          html-for="export-number-from"
          :invalid="!parsedFrom.ok"
        >
          <InputText
            id="export-number-from"
            v-model="numberFromInput"
            class="ic-field"
            placeholder="1 of INC-2026-001"
            autocomplete="off"
          />
        </IcFormField>
        <IcFormField
          label="Incidentnummer tot"
          hint="Nummer of INC-2026-120. Leeg = geen bovengrens."
          html-for="export-number-to"
          :invalid="!parsedTo.ok"
        >
          <InputText
            id="export-number-to"
            v-model="numberToInput"
            class="ic-field"
            placeholder="120 of INC-2026-120"
            autocomplete="off"
          />
        </IcFormField>
      </div>

      <IcFormField
        label="Prioriteit"
        hint="Leeg = alle prioriteiten."
        html-for="export-priority"
      >
        <MultiSelect
          id="export-priority"
          v-model="priorities"
          :options="priorityOptions"
          option-label="label"
          option-value="value"
          placeholder="Alle prioriteiten"
          display="chip"
          class="ic-field w-full"
        />
      </IcFormField>

      <Message
        v-if="filterError"
        severity="warn"
        :closable="false"
      >
        {{ filterError }}
      </Message>

      <p class="text-sm text-slate-600">
        <template v-if="loading">
          Incidenten laden…
        </template>
        <template v-else>
          {{ matchCount }}
          {{ matchCount === 1 ? 'incident' : 'incidenten' }} in deze selectie
          van {{ indexRows.length }} totaal.
        </template>
      </p>

      <div class="flex flex-wrap gap-2">
        <Button
          label="Download CSV"
          icon="pi pi-file"
          severity="secondary"
          outlined
          :loading="exporting === 'csv'"
          :disabled="loading || Boolean(exporting) || !filters"
          @click="onExport('csv')"
        />
        <Button
          label="Download JSON"
          icon="pi pi-download"
          :loading="exporting === 'json'"
          :disabled="loading || Boolean(exporting) || !filters"
          @click="onExport('json')"
        />
      </div>

      <p
        v-if="lastExport"
        class="text-sm text-slate-600"
      >
        {{ lastExport.count }}
        {{ lastExport.count === 1 ? 'incident' : 'incidenten' }}
        geëxporteerd als {{ lastExport.format.toUpperCase() }}.
      </p>
    </form>
  </div>
</template>
