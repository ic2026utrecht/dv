<script setup lang="ts">
import type { Incident, IncidentUpdate } from '~/types/models'
import { DEPARTMENTS, PRIORITIES } from '~/constants/incident'
import {
  expandLocationSectors,
  filterIncidentTypes,
  locationOptions,
  parseSectorCode,
  sectorOptionsForLocation,
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
const { displayName, fetchMe } = useStaffAuth()
const { markRead } = useIncidentFeedUnread()
const { incidents } = useSitrep()

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
  flagEhbo: false,
  flagBeveiliging: false,
  flagHcSafety: false,
  flagReiniging: false,
  flagVeiligheid: false,
  status: 'Open',
  actionOwner: '',
  scenario: '',
  deadline: '',
  closedBy: '',
  closureResult: '',
  parentId: '',
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
  async (incident) => {
    if (!incident) {
      return
    }
    Object.assign(form, incidentToEditForm(incident, config.value))
    await fetchMe().catch(() => {})
    if (displayName.value) {
      if (form.status === 'Afgesloten' && !form.closedBy.trim()) {
        form.closedBy = displayName.value
      }
    }
  },
  { immediate: true },
)

watch(
  () => form.status,
  (status) => {
    if (status === 'Afgesloten' && !form.closedBy.trim() && displayName.value) {
      form.closedBy = displayName.value
    }
  },
)

watch(
  () => config.value,
  () => {
    if (props.incident) {
      Object.assign(form, incidentToEditForm(props.incident, config.value))
    }
  },
)

const updatesRefreshKey = ref(0)

type EditDialogTab = 'form' | 'updates'
const editTab = ref<EditDialogTab>('form')

const DESKTOP_FEED_MQ = '(min-width: 961px)'

function isDesktopFeedLayout(): boolean {
  return import.meta.client && window.matchMedia(DESKTOP_FEED_MQ).matches
}

function markIncidentFeedRead() {
  const incidentId = props.incident?.incidentId
  if (!visible.value || !incidentId) {
    return
  }
  markRead(incidentId).catch(() => {})
}

watch(visible, (open) => {
  if (open) {
    editTab.value = 'form'
    updatesRefreshKey.value += 1
    if (!config.value) {
      fetchConfig().catch(() => {})
    }
    if (isDesktopFeedLayout()) {
      markIncidentFeedRead()
    }
  }
})

watch(editTab, (tab) => {
  if (tab !== 'updates') {
    return
  }
  markIncidentFeedRead()
})

function handleFeedChanged() {
  updatesRefreshKey.value += 1
}

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

const selectedLocation = computed(() =>
  (config.value?.locations ?? []).find(l => l.id === form.locationId),
)

const allowedSectors = computed(() =>
  expandLocationSectors(
    selectedLocation.value,
    config.value?.raster.rows,
    config.value?.raster.columns,
  ),
)

const sectorSelectOptions = computed(() =>
  sectorOptionsForLocation(
    selectedLocation.value,
    config.value?.raster.rows,
    config.value?.raster.columns,
  ),
)

watch(
  () => form.locationId,
  (locationId, previous) => {
    if (!previous || locationId === previous || !form.sectorCode) {
      return
    }
    const allowed = allowedSectors.value
    if (allowed && !allowed.includes(form.sectorCode.toUpperCase())) {
      form.sectorCode = ''
    }
  },
)

const incidentTypeOptions = computed(() =>
  toSelectOptions(filterIncidentTypes(config.value?.incidentTypes ?? [], form.department)),
)

const helpSelectOptions = computed(() =>
  toSelectOptions(config.value?.helpOptions ?? []),
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

const linkedChildren = computed(() => {
  const id = props.incident?.incidentId
  if (!id) {
    return []
  }
  return incidents.value
    .filter(incident => incident.parentId === id)
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
})

const hasLinkedChildren = computed(() => linkedChildren.value.length > 0)

const parentSelectOptions = computed(() => {
  const currentId = props.incident?.incidentId
  const selectedParentId = form.parentId
  const options = incidents.value
    .filter((incident) => {
      if (incident.incidentId === currentId || incident.parentId) {
        return false
      }
      return incident.isOpen || incident.incidentId === selectedParentId
    })
    .map(incident => ({
      value: incident.incidentId,
      label: `${incident.incidentId} · ${incident.incidentTypeName} · ${incident.locationName}`,
    }))

  return [
    { value: '', label: 'Hoofdincident (geen groep)' },
    ...options,
  ]
})

const parentSelectDisabled = computed(() => hasLinkedChildren.value)

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

  const payload = editFormToIncidentUpdate(props.incident.incidentId, form)
  const actor = displayName.value?.trim()
    || (form.status === 'Afgesloten' ? form.closedBy.trim() : '')
    || form.actionOwner.trim()
  if (actor) {
    payload.updatedBy = actor
  }

  emit('save', payload)
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="incident ? `${incident.incidentId} bewerken` : 'Incident'"
    class="ic-sitrep-edit-dialog"
    :style="{ width: 'min(100vw - 2rem, 84rem)' }"
    :draggable="false"
    :dismissable-mask="true"
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

      <div v-else class="ic-sitrep-edit-dialog__body">
        <Tabs v-model:value="editTab" class="ic-sitrep-edit-dialog__tabs">
          <TabList>
            <Tab value="form">
              <i class="pi pi-file-edit mr-1.5" aria-hidden="true" />
              Gegevens
            </Tab>
            <Tab value="updates">
              <i class="pi pi-comments mr-1.5" aria-hidden="true" />
              Updates
            </Tab>
          </TabList>

          <TabPanels :lazy="false">
            <TabPanel value="form">
              <div class="ic-sitrep-edit-dialog__form ic-form">
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
            Groepering
          </h3>

          <IcFormField
            label="Hoofdincident"
            html-for="sitrep-edit-parent"
            :hint="parentSelectDisabled
              ? 'Dit incident heeft sub-incidenten en kan niet onder een ander incident worden geplaatst.'
              : 'Koppel dit incident als sub aan een bestaand hoofdincident.'"
          >
            <Select
              id="sitrep-edit-parent"
              v-model="form.parentId"
              :options="parentSelectOptions"
              option-label="label"
              option-value="value"
              :disabled="parentSelectDisabled"
              filter
              show-clear
              placeholder="Hoofdincident (geen groep)"
              class="ic-field w-full"
            />
          </IcFormField>

          <div v-if="hasLinkedChildren" class="ic-sitrep-edit-dialog__children">
            <p class="ic-sitrep-edit-dialog__children-label">
              Sub-incidenten
            </p>
            <ul class="ic-sitrep-edit-dialog__children-list">
              <li
                v-for="child in linkedChildren"
                :key="child.incidentId"
              >
                <span class="ic-sitrep-edit-dialog__children-id">{{ child.incidentId }}</span>
                <span>{{ child.incidentTypeName }}</span>
                <span class="ic-sitrep-edit-dialog__children-status">{{ child.status || 'Open' }}</span>
              </li>
            </ul>
          </div>
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
        </section>

        <SitrepIncidentClosureFields
          v-if="isClosed"
          v-model:closed-by="form.closedBy"
          v-model:closure-result="form.closureResult"
          id-prefix="sitrep-edit"
        />

              </div>
            </TabPanel>

            <TabPanel value="updates">
              <aside class="ic-sitrep-edit-dialog__feed">
                <SitrepIncidentUpdateFeed
                  :incident="incident"
                  :refresh-key="updatesRefreshKey"
                  @note-added="handleFeedChanged"
                  @update-deleted="handleFeedChanged"
                />
              </aside>
            </TabPanel>
          </TabPanels>
        </Tabs>
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
.ic-sitrep-edit-dialog__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.ic-sitrep-edit-dialog__loading {
  padding: 0.5rem 0;
}

.ic-sitrep-edit-dialog__tabs {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.ic-sitrep-edit-dialog__tabs :deep(.p-tablist) {
  display: none;
  flex-shrink: 0;
  margin: 0 0 0.75rem;
  padding: 0;
  background: transparent;
  border-bottom: 1px solid rgb(135 161 198 / 0.25);
}

.ic-sitrep-edit-dialog__tabs :deep(.p-tablist-tab-list) {
  width: 100%;
  gap: 0.25rem;
}

.ic-sitrep-edit-dialog__tabs :deep(.p-tab) {
  flex: 1 1 0;
  justify-content: center;
  padding: 0.625rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
  border-bottom: 2px solid transparent;
}

.ic-sitrep-edit-dialog__tabs :deep(.p-tab.p-tab-active) {
  color: var(--ic-brand-dark);
  border-bottom-color: var(--ic-orange);
}

.ic-sitrep-edit-dialog__tabs :deep(.p-tabpanels) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(30rem, 42%);
  grid-template-rows: minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.ic-sitrep-edit-dialog__tabs :deep(.p-tabpanel) {
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

@media (min-width: 961px) {
  .ic-sitrep-edit-dialog__tabs :deep(.p-tabpanel) {
    display: flex !important;
  }
}

.ic-sitrep-edit-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 0 1rem 0 0;
}

.ic-sitrep-edit-dialog__feed {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0 0 0 1rem;
  border-left: 1px solid rgb(135 161 198 / 0.25);
}

@media (max-width: 960px) {
  .ic-sitrep-edit-dialog__tabs :deep(.p-tablist) {
    display: flex;
    margin: 0;
  }

  .ic-sitrep-edit-dialog__tabs :deep(.p-tab) {
    padding: 0.5rem 0.625rem;
  }

  .ic-sitrep-edit-dialog__tabs :deep(.p-tabpanels) {
    display: flex;
    flex-direction: column;
    grid-template-columns: none;
    padding: 0;
  }

  .ic-sitrep-edit-dialog__tabs :deep(.p-tabpanel) {
    flex: 1 1 0;
  }

  .ic-sitrep-edit-dialog__tabs :deep(.p-tabpanel:not(.p-tabpanel-active)) {
    display: none !important;
  }

  .ic-sitrep-edit-dialog__tabs :deep(.p-tabpanel.p-tabpanel-active) {
    display: flex !important;
  }

  .ic-sitrep-edit-dialog__form {
    gap: 0.625rem;
    padding: 0 0.5rem;
  }

  .ic-sitrep-edit-dialog__feed {
    padding: 0;
    border-left: 0;
  }

  .ic-sitrep-edit-dialog__feed :deep(.ic-update-feed) {
    border-radius: 0;
    border-left: 0;
    border-right: 0;
  }

  .ic-sitrep-edit-dialog__section {
    padding: 0.625rem;
    border-radius: 0.375rem;
  }

  .ic-sitrep-edit-dialog__loading {
    padding: 0.5rem 0.625rem;
  }
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

.ic-sitrep-edit-dialog__children {
  margin-top: 1rem;
}

.ic-sitrep-edit-dialog__children-label {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}

.ic-sitrep-edit-dialog__children-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.ic-sitrep-edit-dialog__children-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  color: #334155;
}

.ic-sitrep-edit-dialog__children-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 700;
}

.ic-sitrep-edit-dialog__children-status {
  color: #64748b;
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

.ic-sitrep-edit-dialog__form :deep(.p-inputtext),
.ic-sitrep-edit-dialog__form :deep(.p-textarea),
.ic-sitrep-edit-dialog__form :deep(.p-select),
.ic-sitrep-edit-dialog__form :deep(.p-multiselect) {
  width: 100%;
}
</style>

<style>
.ic-sitrep-edit-dialog.p-dialog {
  display: flex;
  flex-direction: column;
  height: min(90vh, 880px);
  max-height: min(90vh, 880px);
}

.ic-sitrep-edit-dialog.p-dialog .p-dialog-content {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.ic-sitrep-edit-dialog.p-dialog .p-dialog-footer {
  flex-shrink: 0;
}

@media (max-width: 960px) {
  .ic-sitrep-edit-dialog.p-dialog {
    width: calc(100vw - 0.5rem) !important;
    height: min(90vh, 900px);
    max-height: min(90vh, 900px);
  }

  .ic-sitrep-edit-dialog.p-dialog .p-dialog-header {
    padding: 0.5rem 0.625rem;
  }

  .ic-sitrep-edit-dialog.p-dialog .p-dialog-title {
    font-size: 0.9375rem;
  }

  .ic-sitrep-edit-dialog.p-dialog .p-dialog-content,
  .ic-sitrep-edit-dialog.p-dialog .ic-sitrep-edit-dialog__content {
    padding: 0 !important;
  }

  .ic-sitrep-edit-dialog.p-dialog .p-dialog-footer {
    padding: 0.5rem 0.625rem;
    gap: 0.375rem;
  }
}
</style>
