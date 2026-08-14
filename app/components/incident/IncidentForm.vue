<script setup lang="ts">
import type { Department, Priority } from '~/types/models'
import { PRIORITIES } from '~/constants/incident'

const props = withDefaults(defineProps<{
  inDialog?: boolean
  showDepartmentSelection?: boolean
  defaultDepartment?: Department
}>(), {
  inDialog: false,
  showDepartmentSelection: false,
  defaultDepartment: 'Parkeer',
})

const emit = defineEmits<{
  submitted: [incidentId: string]
}>()

const { fetchConfig, submitIncident, config, loading, error, isLoaded } = useIncidents()

const department = ref<Department | null>(
  props.showDepartmentSelection ? null : props.defaultDepartment,
)
const locationId = ref<string | null>(null)
const sectorCode = ref<string | null>(null)
const incidentTypeId = ref<string | null>(null)
const priority = ref<Priority | null>(null)
const helpOptionIds = ref<string[]>([])
const description = ref('')
const personsInvolved = ref<string | null>(null)
const ambulanceCalled = ref<'ja' | 'nee' | null>(null)

const submitting = ref(false)
const submitError = ref<string | null>(null)
const submitAttempted = ref(false)
const rasterMapOpen = ref(false)

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

const helpOptions = computed(() => config.value?.helpOptions ?? [])

const locationSelectOptions = computed(() =>
  locationOptions(config.value?.locations ?? []),
)

const selectedLocation = computed(() =>
  (config.value?.locations ?? []).find(l => l.id === locationId.value),
)

const allowedSectors = computed(() =>
  expandLocationSectors(
    selectedLocation.value,
    config.value?.raster.rows ?? RASTER_ROWS,
    config.value?.raster.columns ?? RASTER_COLUMNS,
  ),
)

const sectorSelectOptions = computed(() =>
  sectorOptionsForLocation(
    selectedLocation.value,
    config.value?.raster.rows ?? RASTER_ROWS,
    config.value?.raster.columns ?? RASTER_COLUMNS,
  ),
)

const parsedSector = computed(() =>
  parseSectorCode(
    sectorCode.value,
    config.value?.raster.rows ?? RASTER_ROWS,
    config.value?.raster.columns ?? RASTER_COLUMNS,
  ),
)

const ambulanceOptions = [
  { label: 'Ja', value: 'ja' as const },
  { label: 'Nee', value: 'nee' as const },
]

const isEhbo = computed(() => department.value === 'EHBO')

const priorityOptions = computed(() =>
  PRIORITIES.map(p => ({ value: p, label: p })),
)

const progressTotal = computed(() => (props.showDepartmentSelection ? 5 : 4))

const progressStep = computed(() => {
  if (props.showDepartmentSelection && !department.value) {
    return 1
  }
  if ((!locationId.value && !parsedSector.value) || !priority.value) {
    return props.showDepartmentSelection ? 2 : 1
  }
  if (!incidentTypeId.value) {
    return props.showDepartmentSelection ? 3 : 2
  }
  if (!description.value.trim()) {
    return props.showDepartmentSelection ? 4 : 3
  }
  return props.showDepartmentSelection ? 5 : 4
})

watch(department, () => {
  incidentTypeId.value = null
  helpOptionIds.value = []
  personsInvolved.value = null
  ambulanceCalled.value = null
})

watch(locationId, (newId) => {
  if (sectorCode.value) {
    const allowed = allowedSectors.value
    if (allowed && !allowed.includes(sectorCode.value.toUpperCase())) {
      sectorCode.value = null
    }
  }

  if (newId && allowedSectors.value) {
    rasterMapOpen.value = true
  }
})

const hasPlace = computed(() => Boolean(locationId.value || parsedSector.value))

const canSubmit = computed(() =>
  Boolean(
    department.value
    && hasPlace.value
    && incidentTypeId.value
    && priority.value
    && description.value.trim()
    && (!isEhbo.value || (personsInvolved.value && ambulanceCalled.value !== null)),
  ),
)

type RequiredFieldKey =
  | 'department'
  | 'place'
  | 'priority'
  | 'incidentType'
  | 'description'
  | 'personsInvolved'
  | 'ambulanceCalled'

const requiredFieldLabels: Record<RequiredFieldKey, string> = {
  department: 'Afdeling',
  place: 'Locatie of raster sector',
  priority: 'Prioriteit',
  incidentType: 'Soort incident',
  description: 'Korte omschrijving',
  personsInvolved: 'Aantal betrokkenen',
  ambulanceCalled: '112 gebeld?',
}

const fieldInvalid = computed(() => ({
  department: props.showDepartmentSelection && !department.value,
  place: !hasPlace.value,
  priority: !priority.value,
  incidentType: Boolean(department.value) && !incidentTypeId.value,
  description: !description.value.trim(),
  personsInvolved: isEhbo.value && !personsInvolved.value,
  ambulanceCalled: isEhbo.value && ambulanceCalled.value === null,
}))

const emptyFieldInvalid = (): Record<RequiredFieldKey, boolean> => ({
  department: false,
  place: false,
  priority: false,
  incidentType: false,
  description: false,
  personsInvolved: false,
  ambulanceCalled: false,
})

const showFieldInvalid = computed(() =>
  submitAttempted.value ? fieldInvalid.value : emptyFieldInvalid(),
)

const missingFields = computed(() =>
  (Object.keys(requiredFieldLabels) as RequiredFieldKey[])
    .filter(key => fieldInvalid.value[key])
    .map(key => requiredFieldLabels[key]),
)

async function onSubmit() {
  submitAttempted.value = true

  if (!canSubmit.value || !department.value || !hasPlace.value
    || !incidentTypeId.value || !priority.value) {
    return
  }

  submitting.value = true
  submitError.value = null

  try {
    const result = await submitIncident({
      department: department.value,
      locationId: locationId.value || undefined,
      sectorRow: parsedSector.value?.row,
      sectorColumn: parsedSector.value?.column ?? null,
      incidentTypeId: incidentTypeId.value,
      priority: priority.value,
      helpOptionIds: helpOptionIds.value,
      description: description.value.trim(),
      personsInvolved: isEhbo.value ? Number(personsInvolved.value) : undefined,
      ambulanceCalled: isEhbo.value ? ambulanceCalled.value === 'ja' : undefined,
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
  <div class="ic-form" :class="{ 'ic-form--dialog': props.inDialog }">
    <div v-if="!isLoaded && loading" class="px-5 py-10 sm:px-8">
      <Message severity="info" :closable="false" class="w-full">
        <span class="font-semibold">Configuratie laden…</span>
        <span class="mt-1 block text-sm opacity-90">Locaties en lijsten ophalen uit Google Sheet</span>
      </Message>
    </div>

    <div v-else-if="error" class="px-5 py-10 sm:px-8">
      <Message severity="error" :closable="false" class="w-full">
        <p class="font-semibold">{{ error }}</p>
        <p class="mt-2 text-sm">
          Controleer of de Apps Script Web App URL in <code class="rounded bg-black/10 px-1">.env</code> klopt.
        </p>
        <Button
          label="Opnieuw proberen"
          size="small"
          severity="danger"
          outlined
          class="mt-4"
          @click="fetchConfig(true)"
        />
      </Message>
    </div>

    <form v-else @submit.prevent="onSubmit">
      <!-- Progress -->
      <div class="ic-progress" aria-hidden="true">
        <div
          v-for="n in progressTotal"
          :key="n"
          class="ic-progress-segment"
          :class="{
            'ic-progress-segment--done': n < progressStep,
            'ic-progress-segment--active': n === progressStep,
          }"
        />
      </div>

      <div class="space-y-4 px-4 py-5">
        <!-- Step 1: Department -->
        <section v-if="showDepartmentSelection" class="ic-card ic-card--accent">
          <p class="ic-section-title">
            Stap 1 · Afdeling
          </p>
          <h2 class="ic-section-heading">
            Wie meldt dit incident?
          </h2>
          <div class="ic-field" :class="{ 'ic-field--invalid': showFieldInvalid.department }">
            <DepartmentTiles v-model="department" />
          </div>
        </section>

        <!-- Step 2: Location & priority -->
        <section class="ic-card">
          <p class="ic-section-title">
            Stap {{ showDepartmentSelection ? 2 : 1 }} · Locatie
          </p>
          <h2 class="ic-section-heading">
            Waar is het incident?
          </h2>

          <div class="flex flex-col gap-5">
            <IcFormField
              label="Locatie"
              html-for="location"
              hint="Kies de dichtstbijzijnde hal, entree of zone (of vul een sector in)"
              :invalid="showFieldInvalid.place"
            >
              <Select
                id="location"
                v-model="locationId"
                :options="locationSelectOptions"
                option-label="label"
                option-value="value"
                placeholder="Selecteer locatie…"
                filter
                auto-filter-focus
                fluid
              />
            </IcFormField>

            <IcFormField
              label="Raster sector"
              html-for="sector"
              hint="Bijv. A1 of E7 — rij A t/m M, kolom 1 t/m 22 (of kies een locatie)"
              :invalid="showFieldInvalid.place"
            >
              <Select
                id="sector"
                v-model="sectorCode"
                :options="sectorSelectOptions"
                option-label="label"
                option-value="value"
                placeholder="Bijv. A1"
                filter
                auto-filter-focus
                filter-placeholder="Zoek sector…"
                fluid
              />
            </IcFormField>

            <button
              type="button"
              class="ic-map-link"
              @click="rasterMapOpen = true"
            >
              <i class="pi pi-map" aria-hidden="true" />
              Rasterkaart openen
            </button>

            <RasterMapDialog
              v-model="rasterMapOpen"
              :selected-sector="sectorCode"
              :allowed-sectors="allowedSectors"
              @select="sectorCode = $event"
            />

            <IcFormField
              label="Prioriteit"
              required
              hint="Critical alleen bij direct gevaar of 112"
              :invalid="showFieldInvalid.priority"
            >
              <ChoiceButtons
                v-model="priority"
                :options="priorityOptions"
                variant="priority"
              />
            </IcFormField>
          </div>
        </section>

        <!-- Step 3: Incident details -->
        <section v-if="department" class="ic-card">
          <p class="ic-section-title">
            Stap {{ showDepartmentSelection ? 3 : 2 }} · {{ department }}
          </p>
          <h2 class="ic-section-heading">
            Wat is er aan de hand?
          </h2>

          <div class="grid gap-5">
            <IcFormField label="Soort incident" html-for="incident-type" required :invalid="showFieldInvalid.incidentType">
              <Select
                id="incident-type"
                v-model="incidentTypeId"
                :options="toSelectOptions(incidentTypes)"
                option-label="label"
                option-value="value"
                placeholder="Selecteer type…"
                filter
                fluid
              />
            </IcFormField>

            <template v-if="isEhbo">
              <IcFormField label="Aantal betrokkenen" html-for="persons" required :invalid="showFieldInvalid.personsInvolved">
                <Select
                  id="persons"
                  v-model="personsInvolved"
                  :options="config?.personsCountOptions ?? []"
                  option-label="label"
                  option-value="value"
                  placeholder="Aantal"
                  fluid
                />
              </IcFormField>

              <IcFormField label="112 gebeld?" required :invalid="showFieldInvalid.ambulanceCalled">
                <ChoiceButtons
                  v-model="ambulanceCalled"
                  :options="ambulanceOptions"
                />
              </IcFormField>
            </template>

            <IcFormField
              label="Directe hulp uitgezet"
              hint="Meerdere opties mogelijk"
            >
              <MultiSelect
                v-model="helpOptionIds"
                :options="toSelectOptions(helpOptions)"
                option-label="label"
                option-value="value"
                placeholder="Selecteer ingezette hulp…"
                display="chip"
                fluid
              />
            </IcFormField>
          </div>
        </section>

        <section
          v-else-if="showDepartmentSelection"
          class="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-slate-500"
        >
          <i class="pi pi-arrow-up mb-2 text-2xl" aria-hidden="true" />
          <p class="font-semibold">
            Kies eerst een afdeling
          </p>
          <p class="mt-1 text-sm">
            Daarna verschijnen de incident-specifieke velden
          </p>
        </section>

        <!-- Step 4: Description -->
        <section class="ic-card">
          <p class="ic-section-title">
            Stap {{ showDepartmentSelection ? 4 : 3 }} · Melding
          </p>
          <h2 class="ic-section-heading">
            Omschrijving
          </h2>

          <IcFormField
            label="Korte omschrijving"
            html-for="description"
            required
            hint="Eén zin: wat gebeurt er, op dit moment? (GEEN PERSOONSGEGEVENS)"
            :invalid="showFieldInvalid.description"
          >
            <Textarea
              id="description"
              v-model="description"
              rows="3"
              auto-resize
              placeholder="Bijv. Rook uit kabelgoot bij stand 12…"
              fluid
            />
          </IcFormField>
        </section>

        <Message v-if="submitError" severity="error" :closable="false">
          {{ submitError }}
        </Message>
      </div>

      <!-- Sticky submit -->
      <div class="ic-submit-bar" :class="{ 'ic-submit-bar--dialog': props.inDialog }">
        <div class="ic-submit-inner">
          <p
            v-if="canSubmit"
            class="text-center text-sm font-semibold text-[var(--ic-orange)]"
          >
            Klaar om te versturen
          </p>
          <div v-else-if="submitAttempted" class="text-center text-sm" aria-live="polite">
            <p class="font-semibold text-slate-600">
              Nog invullen:
            </p>
            <p class="mt-1 font-semibold text-red-600">
              {{ missingFields.join(' · ') }}
            </p>
          </div>
          <Button
            type="submit"
            label="Melding versturen"
            icon="pi pi-send"
            fluid
            size="large"
            :loading="submitting"
            :disabled="submitting"
          />
        </div>
      </div>
    </form>
  </div>
</template>
