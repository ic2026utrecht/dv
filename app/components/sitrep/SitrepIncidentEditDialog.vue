<script setup lang="ts">
import type { Incident, IncidentUpdate } from '~/types/models'
import { DEPARTMENTS, PRIORITIES } from '~/constants/incident'
import {
  buildSectorOptions,
  filterHelpOptions,
  filterIncidentTypes,
  locationOptions,
  parseSectorCode,
  toSelectOptions,
} from '~/utils/incidentOptions'
import {
  editFormToIncidentUpdate,
  incidentToEditForm,
  type IncidentEditForm,
} from '~/utils/incidentEdit'

const visible = defineModel<boolean>({ default: false })

const props = defineProps<{
  incident: Incident | null
  saving?: boolean
}>()

const emit = defineEmits<{
  save: [payload: IncidentUpdate]
}>()

const { fetchConfig, config, loading: configLoading } = useIncidents()

const form = reactive<IncidentEditForm>({
  timestamp: '',
  department: 'Dienstverlening',
  locationId: '',
  sectorCode: '',
  sectorLabel: '',
  incidentTypeId: '',
  description: '',
  helpOptionIds: [],
  priority: 'Middel',
  reporter: '',
  freeField: '',
  flagEhbo: false,
  flagBeveiliging: false,
  flagHcSafety: false,
  flagReiniging: false,
  flagVeiligheid: false,
  status: 'Open',
  actionOwner: '',
  scenario: '',
  deadline: '',
  updateNotes: '',
  closedBy: '',
  closureResult: '',
  latitude: '',
  longitude: '',
})

const STATUS_OPTIONS = [
  { value: 'Open', label: 'Open' },
  { value: 'In behandeling', label: 'In behandeling' },
  { value: 'Afgesloten', label: 'Afgesloten' },
] as const

const departmentOptions = DEPARTMENTS.map(d => ({ value: d, label: d }))
const priorityOptions = PRIORITIES.map(p => ({ value: p, label: p }))

const teamFlags = [
  { key: 'flagEhbo' as const, label: 'EHBO' },
  { key: 'flagBeveiliging' as const, label: 'Beveiliging' },
  { key: 'flagHcSafety' as const, label: 'Afd. HC Safety' },
  { key: 'flagReiniging' as const, label: 'Reiniging' },
  { key: 'flagVeiligheid' as const, label: 'Veiligheid' },
]

watch(
  () => props.incident,
  (incident) => {
    if (!incident) {
      return
    }
    Object.assign(form, incidentToEditForm(incident, config.value))
  },
  { immediate: true },
)

watch(
  () => config.value,
  () => {
    if (props.incident) {
      Object.assign(form, incidentToEditForm(props.incident, config.value))
    }
  },
)

watch(visible, (open) => {
  if (open && !config.value) {
    fetchConfig().catch(() => {})
  }
})

watch(
  () => form.department,
  (department, previous) => {
    if (!previous || department === previous) {
      return
    }
    form.incidentTypeId = ''
    form.helpOptionIds = []
  },
)

const locationSelectOptions = computed(() =>
  locationOptions(config.value?.locations ?? []),
)

const sectorSelectOptions = computed(() =>
  buildSectorOptions(
    config.value?.raster.rows,
    config.value?.raster.columns,
  ),
)

const incidentTypeOptions = computed(() =>
  toSelectOptions(filterIncidentTypes(config.value?.incidentTypes ?? [], form.department)),
)

const helpSelectOptions = computed(() =>
  toSelectOptions(filterHelpOptions(config.value?.helpOptions ?? [], form.department)),
)

const parsedSector = computed(() =>
  parseSectorCode(
    form.sectorCode,
    config.value?.raster.rows,
    config.value?.raster.columns,
  ),
)

const showSectorLabel = computed(() => Boolean(form.sectorCode && !parsedSector.value))

const isClosed = computed(() => form.status === 'Afgesloten')

function formatReadOnlyTime(value?: string): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function close() {
  visible.value = false
}

function submit() {
  if (!props.incident) {
    return
  }

  emit('save', editFormToIncidentUpdate(props.incident.incidentId, form))
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="incident ? `${incident.incidentId} bewerken` : 'Incident'"
    class="ic-sitrep-edit-dialog"
    :style="{ width: 'min(100vw - 2rem, 42rem)' }"
    :draggable="false"
    block-scroll
    content-class="ic-sitrep-edit-dialog__content"
    @hide="close"
  >
    <template v-if="incident">
      <div v-if="configLoading && !config" class="ic-sitrep-edit-dialog__loading">
        <Message severity="info" :closable="false">
          Configuratie laden…
        </Message>
      </div>

      <div v-else class="ic-sitrep-edit-dialog__form">
        <section class="ic-sitrep-edit-dialog__section">
          <h3 class="ic-sitrep-edit-dialog__heading">
            Identificatie
          </h3>
          <dl class="ic-sitrep-edit-dialog__meta">
            <div>
              <dt>Incident-ID</dt>
              <dd>{{ incident.incidentId }}</dd>
            </div>
            <div>
              <dt>Bron</dt>
              <dd>{{ incident.sourceRow || '—' }}</dd>
            </div>
            <div>
              <dt>Laatste update</dt>
              <dd>{{ formatReadOnlyTime(incident.lastUpdate) }}</dd>
            </div>
            <div>
              <dt>Open</dt>
              <dd>{{ incident.isOpen ? `${Math.round(incident.ageMinutes)} min` : 'Afgesloten' }}</dd>
            </div>
          </dl>
        </section>

        <section class="ic-sitrep-edit-dialog__section">
          <h3 class="ic-sitrep-edit-dialog__heading">
            Melding
          </h3>

          <IcFormField label="Tijdstempel" html-for="sitrep-edit-timestamp">
            <InputText
              id="sitrep-edit-timestamp"
              v-model="form.timestamp"
              type="datetime-local"
              class="ic-field w-full"
            />
          </IcFormField>

          <IcFormField label="Afdeling" html-for="sitrep-edit-department" class="mt-4">
            <Select
              id="sitrep-edit-department"
              v-model="form.department"
              :options="departmentOptions"
              option-label="label"
              option-value="value"
              class="ic-field w-full"
            />
          </IcFormField>

          <IcFormField label="Locatie" html-for="sitrep-edit-location" class="mt-4">
            <Select
              id="sitrep-edit-location"
              v-model="form.locationId"
              :options="locationSelectOptions"
              option-label="label"
              option-value="value"
              filter
              placeholder="Selecteer locatie…"
              class="ic-field w-full"
            />
          </IcFormField>

          <IcFormField
            label="Raster sector"
            html-for="sitrep-edit-sector"
            hint="Bijv. A1 of E7 — rij A t/m M, kolom 1 t/m 22"
            class="mt-4"
          >
            <Select
              id="sitrep-edit-sector"
              v-model="form.sectorCode"
              :options="sectorSelectOptions"
              option-label="label"
              option-value="value"
              filter
              editable
              placeholder="Bijv. A1"
              class="ic-field w-full"
            />
          </IcFormField>

          <IcFormField
            v-if="showSectorLabel"
            label="Vrije sector"
            html-for="sitrep-edit-sector-label"
            hint="Gebruik bij afwijkende sectornotatie uit het formulier"
            class="mt-4"
          >
            <InputText
              id="sitrep-edit-sector-label"
              v-model="form.sectorLabel"
              class="ic-field w-full"
              placeholder="Bijv. Parkeervak entree"
            />
          </IcFormField>

          <IcFormField label="Soort incident" html-for="sitrep-edit-type" class="mt-4">
            <Select
              id="sitrep-edit-type"
              v-model="form.incidentTypeId"
              :options="incidentTypeOptions"
              option-label="label"
              option-value="value"
              filter
              placeholder="Selecteer type…"
              class="ic-field w-full"
            />
          </IcFormField>

          <IcFormField label="Prioriteit" class="mt-4">
            <ChoiceButtons
              v-model="form.priority"
              :options="priorityOptions"
              variant="priority"
            />
          </IcFormField>

          <IcFormField label="Korte omschrijving" html-for="sitrep-edit-description" class="mt-4">
            <Textarea
              id="sitrep-edit-description"
              v-model="form.description"
              class="ic-field w-full"
              rows="3"
              auto-resize
            />
          </IcFormField>

          <IcFormField label="Melder (naam en nummer)" html-for="sitrep-edit-reporter" class="mt-4">
            <InputText
              id="sitrep-edit-reporter"
              v-model="form.reporter"
              class="ic-field w-full"
            />
          </IcFormField>

          <IcFormField label="Vrije veld" html-for="sitrep-edit-free-field" class="mt-4">
            <Textarea
              id="sitrep-edit-free-field"
              v-model="form.freeField"
              class="ic-field w-full"
              rows="2"
              auto-resize
              placeholder="Extra opmerkingen uit het formulier"
            />
          </IcFormField>
        </section>

        <section class="ic-sitrep-edit-dialog__section">
          <h3 class="ic-sitrep-edit-dialog__heading">
            Hulp &amp; teams
          </h3>

          <IcFormField label="Directe hulp uitgezet">
            <MultiSelect
              v-model="form.helpOptionIds"
              :options="helpSelectOptions"
              option-label="label"
              option-value="value"
              placeholder="Selecteer ingezette hulp…"
              display="chip"
              class="ic-field w-full"
            />
          </IcFormField>

          <fieldset class="ic-sitrep-edit-dialog__flags mt-4">
            <legend class="ic-label">
              Betrokken teams
            </legend>
            <div class="ic-sitrep-edit-dialog__flags-grid">
              <label
                v-for="flag in teamFlags"
                :key="flag.key"
                class="ic-sitrep-edit-dialog__flag"
              >
                <Checkbox v-model="form[flag.key]" binary />
                <span>{{ flag.label }}</span>
              </label>
            </div>
          </fieldset>
        </section>

        <section class="ic-sitrep-edit-dialog__section">
          <h3 class="ic-sitrep-edit-dialog__heading">
            Opvolging
          </h3>

          <IcFormField label="Status" html-for="sitrep-edit-status">
            <Select
              id="sitrep-edit-status"
              v-model="form.status"
              :options="STATUS_OPTIONS"
              option-label="label"
              option-value="value"
              class="ic-field w-full"
            />
          </IcFormField>

          <IcFormField label="Actiehouder" html-for="sitrep-edit-action-owner" class="mt-4">
            <InputText
              id="sitrep-edit-action-owner"
              v-model="form.actionOwner"
              class="ic-field w-full"
              placeholder="Naam of functie"
            />
          </IcFormField>

          <IcFormField label="Scenario" html-for="sitrep-edit-scenario" class="mt-4">
            <InputText
              id="sitrep-edit-scenario"
              v-model="form.scenario"
              class="ic-field w-full"
            />
          </IcFormField>

          <IcFormField label="Deadline" html-for="sitrep-edit-deadline" class="mt-4">
            <InputText
              id="sitrep-edit-deadline"
              v-model="form.deadline"
              type="datetime-local"
              class="ic-field w-full"
            />
          </IcFormField>

          <IcFormField label="Omschrijving update" html-for="sitrep-edit-update-notes" class="mt-4">
            <Textarea
              id="sitrep-edit-update-notes"
              v-model="form.updateNotes"
              class="ic-field w-full"
              rows="3"
              auto-resize
              placeholder="Nieuwe update (wordt opgeslagen in het sheet)"
            />
          </IcFormField>
        </section>

        <section class="ic-sitrep-edit-dialog__section">
          <h3 class="ic-sitrep-edit-dialog__heading">
            Afsluiting
          </h3>

          <IcFormField label="Afgesloten door" html-for="sitrep-edit-closed-by">
            <InputText
              id="sitrep-edit-closed-by"
              v-model="form.closedBy"
              class="ic-field w-full"
              :placeholder="isClosed ? '' : 'Invullen bij status Afgesloten'"
            />
          </IcFormField>

          <IcFormField label="Afsluiting / resultaat" html-for="sitrep-edit-closure-result" class="mt-4">
            <Textarea
              id="sitrep-edit-closure-result"
              v-model="form.closureResult"
              class="ic-field w-full"
              rows="3"
              auto-resize
              :placeholder="isClosed ? '' : 'Invullen bij status Afgesloten'"
            />
          </IcFormField>
        </section>

        <section class="ic-sitrep-edit-dialog__section">
          <h3 class="ic-sitrep-edit-dialog__heading">
            GPS (optioneel)
          </h3>

          <div class="ic-sitrep-edit-dialog__coords">
            <IcFormField label="Latitude" html-for="sitrep-edit-latitude">
              <InputText
                id="sitrep-edit-latitude"
                v-model="form.latitude"
                class="ic-field w-full"
                inputmode="decimal"
              />
            </IcFormField>
            <IcFormField label="Longitude" html-for="sitrep-edit-longitude">
              <InputText
                id="sitrep-edit-longitude"
                v-model="form.longitude"
                class="ic-field w-full"
                inputmode="decimal"
              />
            </IcFormField>
          </div>
        </section>

      </div>
    </template>

    <template #footer>
      <Button
        label="Annuleren"
        severity="secondary"
        text
        :disabled="saving"
        @click="close"
      />
      <Button
        label="Opslaan"
        icon="pi pi-check"
        :loading="saving"
        :disabled="!incident || (configLoading && !config)"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.ic-sitrep-edit-dialog__content {
  max-height: min(85dvh, 760px);
  overflow-y: auto;
}

.ic-sitrep-edit-dialog__loading {
  padding: 0.5rem 0;
}

.ic-sitrep-edit-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ic-sitrep-edit-dialog__section {
  padding: 0.875rem;
  border-radius: 0.5rem;
  background: var(--ic-surface-muted);
  border: 1px solid rgb(135 161 198 / 0.35);
}

.ic-sitrep-edit-dialog__heading {
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ic-brand-dark);
}

.ic-sitrep-edit-dialog__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
  font-size: 0.8125rem;
}

.ic-sitrep-edit-dialog__meta dt {
  color: #64748b;
}

.ic-sitrep-edit-dialog__meta dd {
  margin-top: 0.125rem;
  font-weight: 600;
  color: #334155;
}

.ic-sitrep-edit-dialog__flags {
  border: 0;
  padding: 0;
  margin: 0;
}

.ic-sitrep-edit-dialog__flags-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 1rem;
  margin-top: 0.5rem;
}

.ic-sitrep-edit-dialog__flag {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #334155;
}

.ic-sitrep-edit-dialog__coords {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.ic-sitrep-edit-dialog__form :deep(.p-inputtext),
.ic-sitrep-edit-dialog__form :deep(.p-textarea),
.ic-sitrep-edit-dialog__form :deep(.p-select),
.ic-sitrep-edit-dialog__form :deep(.p-multiselect) {
  width: 100%;
}
</style>
