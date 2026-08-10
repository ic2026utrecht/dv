<script setup lang="ts">
import type { Department, Priority } from '~/types/models'

const emit = defineEmits<{
  submitted: [incidentId: string]
}>()

const { fetchConfig, submitIncident, config, loading, error, isLoaded } = useIncidents()

const department = ref<Department | null>(null)
const locationId = ref<string | null>(null)
const sectorCode = ref<string | null>(null)
const incidentTypeId = ref<string | null>(null)
const priority = ref<Priority | null>(null)
const helpOptionIds = ref<string[]>([])
const {
  reporterName,
  reporterPhone,
  reporterFormatted,
  hasReporterContact,
  persistReporterContact,
} = useReporterContact()
const description = ref('')
const personsInvolved = ref<string | null>(null)
const ambulanceCalled = ref<'ja' | 'nee' | null>(null)

const submitting = ref(false)
const submitError = ref<string | null>(null)
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

const helpOptions = computed(() =>
  filterHelpOptions(config.value?.helpOptions ?? [], department.value),
)

const locationSelectOptions = computed(() =>
  locationOptions(config.value?.locations ?? []),
)

const sectorSelectOptions = computed(() =>
  buildSectorOptions(
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

const priorityOptions = computed(() => config.value?.priorities ?? [])

const progressStep = computed(() => {
  if (!department.value) return 1
  if (!locationId.value || !parsedSector.value || !priority.value) return 2
  if (!incidentTypeId.value) return 3
  if (!description.value.trim() || !hasReporterContact.value) return 4
  return 5
})

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
    && parsedSector.value
    && incidentTypeId.value
    && priority.value
    && hasReporterContact.value
    && description.value.trim()
    && (!isEhbo.value || (personsInvolved.value && ambulanceCalled.value !== null)),
  ),
)

async function onSubmit() {
  if (!canSubmit.value || !department.value || !locationId.value || !parsedSector.value
    || !incidentTypeId.value || !priority.value) {
    return
  }

  submitting.value = true
  submitError.value = null

  try {
    const result = await submitIncident({
      department: department.value,
      locationId: locationId.value,
      sectorRow: parsedSector.value.row,
      sectorColumn: parsedSector.value.column,
      incidentTypeId: incidentTypeId.value,
      priority: priority.value,
      helpOptionIds: helpOptionIds.value,
      reporter: reporterFormatted.value,
      description: description.value.trim(),
      personsInvolved: isEhbo.value ? Number(personsInvolved.value) : undefined,
      ambulanceCalled: isEhbo.value ? ambulanceCalled.value === 'ja' : undefined,
    })
    persistReporterContact()
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
  <div class="ic-form">
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
          v-for="n in 5"
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
        <section class="ic-card ic-card--accent">
          <p class="ic-section-title">
            Stap 1 · Afdeling
          </p>
          <h2 class="ic-section-heading">
            Wie meldt dit incident?
          </h2>
          <DepartmentTiles v-model="department" />
        </section>

        <!-- Step 2: Location & priority -->
        <section class="ic-card">
          <p class="ic-section-title">
            Stap 2 · Locatie
          </p>
          <h2 class="ic-section-heading">
            Waar is het incident?
          </h2>

          <div class="flex flex-col gap-5">
            <IcFormField
              label="Locatie"
              html-for="location"
              required
              hint="Kies de dichtstbijzijnde hal, entree of zone"
            >
              <Select
                id="location"
                v-model="locationId"
                :options="locationSelectOptions"
                option-label="label"
                option-value="value"
                placeholder="Selecteer locatie…"
                filter
                fluid
              />
            </IcFormField>

            <IcFormField
              label="Raster sector"
              html-for="sector"
              required
              hint="Bijv. A1 of E7 — rij A t/m M, kolom 1 t/m 22"
            >
              <Select
                id="sector"
                v-model="sectorCode"
                :options="sectorSelectOptions"
                option-label="label"
                option-value="value"
                placeholder="Bijv. A1"
                filter
                editable
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
              @select="sectorCode = $event"
            />

            <IcFormField
              label="Prioriteit"
              required
              hint="Critical alleen bij direct gevaar of 112"
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
            Stap 3 · {{ department }}
          </p>
          <h2 class="ic-section-heading">
            Wat is er aan de hand?
          </h2>

          <div class="grid gap-5">
            <IcFormField label="Soort incident" html-for="incident-type" required>
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
              <IcFormField label="Aantal betrokkenen" html-for="persons" required>
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

              <IcFormField label="112 gebeld?" required>
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
          v-else
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
            Stap 4 · Melding
          </p>
          <h2 class="ic-section-heading">
            Omschrijving &amp; melder
          </h2>

          <div class="grid gap-5">
            <IcFormField
              label="Korte omschrijving"
              html-for="description"
              required
              hint="Eén zin: wat gebeurt er, op dit moment?"
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

            <IcFormField
              label="Naam melder"
              html-for="reporter-name"
              required
              hint="Voor terugkoppeling"
            >
              <InputText
                id="reporter-name"
                v-model="reporterName"
                autocomplete="name"
                placeholder="Jan Jansen"
                fluid
                @blur="persistReporterContact"
              />
            </IcFormField>

            <IcFormField
              label="Telefoonnummer"
              html-for="reporter-phone"
              required
            >
              <InputText
                id="reporter-phone"
                v-model="reporterPhone"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                placeholder="06 12345678"
                fluid
                @blur="persistReporterContact"
              />
            </IcFormField>
          </div>
        </section>

        <Message v-if="submitError" severity="error" :closable="false">
          {{ submitError }}
        </Message>
      </div>

      <!-- Sticky submit -->
      <div class="ic-submit-bar">
        <div class="ic-submit-inner">
          <p class="text-center text-sm font-semibold" :class="canSubmit ? 'text-[var(--ic-brand)]' : 'text-slate-600'">
            {{ canSubmit ? 'Klaar om te versturen' : 'Vul alle verplichte velden in' }}
          </p>
          <Button
            type="submit"
            label="Melding versturen"
            icon="pi pi-send"
            fluid
            :loading="submitting"
            :disabled="!canSubmit || submitting"
          />
        </div>
      </div>
    </form>
  </div>
</template>
