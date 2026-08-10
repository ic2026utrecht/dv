<script setup lang="ts">
import type { Department, Priority } from '~/types/models'

const emit = defineEmits<{
  submitted: [incidentId: string]
}>()

const { fetchConfig, submitIncident, config, loading, error, isLoaded } = useIncidents()

const department = ref<Department | null>(null)
const locationId = ref<string | null>(null)
const sectorRow = ref<string | null>(null)
const sectorColumn = ref<string | null>(null)
const incidentTypeId = ref<string | null>(null)
const priority = ref<Priority | null>(null)
const helpOptionIds = ref<string[]>([])
const reporter = ref('')
const description = ref('')
const personsInvolved = ref<string | null>(null)
const ambulanceCalled = ref<boolean | null>(null)

const submitting = ref(false)
const submitError = ref<string | null>(null)

onMounted(async () => {
  try {
    await fetchConfig()
  }
  catch {
    // error surfaced via store
  }
})

const incidentTypes = computed(() =>
  filterIncidentTypes(config.value?.incidentTypes ?? [], department.value),
)

const helpOptions = computed(() =>
  filterHelpOptions(config.value?.helpOptions ?? [], department.value),
)

const locationSelectOptions = computed(() =>
  locationOptions(config.value?.locations ?? []),
)

const rowSelectOptions = computed(() =>
  rowOptions(config.value?.raster.rows ?? RASTER_ROWS),
)

const columnSelectOptions = computed(() =>
  columnOptions(config.value?.raster.columns ?? RASTER_COLUMNS),
)

const sectorPreview = computed(() => {
  if (!sectorRow.value || !sectorColumn.value) return null
  return formatSector(sectorRow.value, Number(sectorColumn.value))
})

const isEhbo = computed(() => department.value === 'EHBO')

watch(department, () => {
  incidentTypeId.value = null
  helpOptionIds.value = []
  personsInvolved.value = null
  ambulanceCalled.value = null
})

const canSubmit = computed(() =>
  Boolean(
    department.value
    && locationId.value
    && sectorRow.value
    && sectorColumn.value
    && incidentTypeId.value
    && priority.value
    && reporter.value.trim()
    && description.value.trim()
    && (!isEhbo.value || (personsInvolved.value && ambulanceCalled.value !== null)),
  ),
)

async function onSubmit() {
  if (!canSubmit.value || !department.value || !locationId.value || !sectorRow.value
    || !sectorColumn.value || !incidentTypeId.value || !priority.value) {
    return
  }

  submitting.value = true
  submitError.value = null

  try {
    const result = await submitIncident({
      department: department.value,
      locationId: locationId.value,
      sectorRow: sectorRow.value,
      sectorColumn: Number(sectorColumn.value),
      incidentTypeId: incidentTypeId.value,
      priority: priority.value,
      helpOptionIds: helpOptionIds.value,
      reporter: reporter.value.trim(),
      description: description.value.trim(),
      personsInvolved: isEhbo.value ? Number(personsInvolved.value) : undefined,
      ambulanceCalled: isEhbo.value ? ambulanceCalled.value ?? undefined : undefined,
    })
    emit('submitted', result.incidentId)
  }
  catch (err: unknown) {
    submitError.value = err instanceof Error ? err.message : 'Versturen mislukt'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <Message v-if="!isLoaded && loading" severity="info" :closable="false">
      Configuratie laden van Google Sheet…
    </Message>

    <Message v-else-if="error" severity="error" :closable="false">
      <p>{{ error }}</p>
      <p class="mt-2 text-sm">
        Controleer of de Apps Script Web App URL is geconfigureerd en gedeployed is.
      </p>
      <Button
        label="Opnieuw proberen"
        size="small"
        class="mt-3"
        @click="fetchConfig(true)"
      />
    </Message>

    <form v-else class="space-y-6" @submit.prevent="onSubmit">
      <section class="ic-card p-5">
        <h2 class="ic-section-title">
          Algemeen
        </h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="ic-label" for="department">Afdeling *</label>
            <Select
              id="department"
              v-model="department"
              :options="config?.departments ?? []"
              option-label="label"
              option-value="value"
              placeholder="Kies afdeling"
              class="w-full"
            />
          </div>

          <div class="sm:col-span-2">
            <label class="ic-label" for="location">Locatie *</label>
            <Select
              id="location"
              v-model="locationId"
              :options="locationSelectOptions"
              option-label="label"
              option-value="value"
              placeholder="Kies locatie"
              filter
              class="w-full"
            />
          </div>

          <div>
            <label class="ic-label" for="sector-row">Raster rij *</label>
            <Select
              id="sector-row"
              v-model="sectorRow"
              :options="rowSelectOptions"
              option-label="label"
              option-value="value"
              placeholder="A–M"
              class="w-full"
            />
          </div>

          <div>
            <label class="ic-label" for="sector-col">Raster kolom *</label>
            <Select
              id="sector-col"
              v-model="sectorColumn"
              :options="columnSelectOptions"
              option-label="label"
              option-value="value"
              placeholder="1–22"
              class="w-full"
            />
          </div>

          <div v-if="sectorPreview" class="sm:col-span-2 flex flex-wrap items-center gap-3">
            <Tag severity="info" :value="`Sector: ${sectorPreview}`" />
            <NuxtLink
              to="/raster-map.png"
              target="_blank"
              class="text-sm text-blue-700 underline"
            >
              Rasterkaart openen
            </NuxtLink>
          </div>

          <div class="sm:col-span-2">
            <label class="ic-label" for="priority">Prioriteit *</label>
            <SelectButton
              id="priority"
              v-model="priority"
              :options="config?.priorities ?? []"
              option-label="label"
              option-value="value"
            />
          </div>
        </div>
      </section>

      <section v-if="department" class="ic-card p-5">
        <h2 class="ic-section-title">
          {{ department }}
        </h2>

        <div class="grid gap-4">
          <div>
            <label class="ic-label" for="incident-type">Soort incident *</label>
            <Select
              id="incident-type"
              v-model="incidentTypeId"
              :options="toSelectOptions(incidentTypes)"
              option-label="label"
              option-value="value"
              placeholder="Kies type"
              filter
              class="w-full"
            />
          </div>

          <template v-if="isEhbo">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="ic-label" for="persons">Aantal betrokkenen *</label>
                <Select
                  id="persons"
                  v-model="personsInvolved"
                  :options="config?.personsCountOptions ?? []"
                  option-label="label"
                  option-value="value"
                  placeholder="Aantal"
                  class="w-full"
                />
              </div>
              <div>
                <label class="ic-label">112 gebeld? *</label>
                <SelectButton
                  v-model="ambulanceCalled"
                  :options="[{ label: 'Ja', value: true }, { label: 'Nee', value: false }]"
                  option-label="label"
                  option-value="value"
                />
              </div>
            </div>
          </template>

          <div>
            <label class="ic-label">Directe hulp uitgezet</label>
            <MultiSelect
              v-model="helpOptionIds"
              :options="toSelectOptions(helpOptions)"
              option-label="label"
              option-value="value"
              placeholder="Selecteer hulp"
              display="chip"
              class="w-full"
            />
          </div>
        </div>
      </section>

      <section class="ic-card p-5">
        <h2 class="ic-section-title">
          Melding
        </h2>

        <div class="grid gap-4">
          <div>
            <label class="ic-label" for="description">Korte omschrijving *</label>
            <Textarea
              id="description"
              v-model="description"
              rows="3"
              auto-resize
              placeholder="Wat gebeurt er, op dit moment?"
              class="w-full"
            />
          </div>

          <div>
            <label class="ic-label" for="reporter">Melder (naam + telefoon) *</label>
            <InputText
              id="reporter"
              v-model="reporter"
              placeholder="Naam 06-…"
              class="w-full"
            />
          </div>
        </div>
      </section>

      <Message v-if="submitError" severity="error" :closable="false">
        {{ submitError }}
      </Message>

      <div class="flex justify-end gap-3">
        <Button
          type="submit"
          label="Melding versturen"
          icon="pi pi-send"
          :loading="submitting"
          :disabled="!canSubmit || submitting"
        />
      </div>
    </form>
  </div>
</template>
