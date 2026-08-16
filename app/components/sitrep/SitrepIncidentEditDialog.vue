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
const { openEditIncident } = useSitrepEditIncident()

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
  personsInvolved: '',
  ambulanceCalled: null,
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

const ambulanceOptions = [
  { label: 'Ja', value: 'ja' as const },
  { label: 'Nee', value: 'nee' as const },
]

const isEhbo = computed(() => form.department === 'EHBO')

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

type EditDialogTab = 'form' | 'updates' | 'children'
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

watch(
  () => props.incident?.incidentId,
  () => {
    editTab.value = 'form'
    updatesRefreshKey.value += 1
  },
)

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
    if (department !== 'EHBO') {
      form.personsInvolved = ''
      form.ambulanceCalled = null
    }
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

const linkedChildrenOpenCount = computed(() =>
  linkedChildren.value.filter(child => child.isOpen).length,
)

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

const parentIncident = computed(() => {
  const parentId = props.incident?.parentId?.trim()
  if (!parentId) {
    return null
  }
  return incidents.value.find(incident => incident.incidentId === parentId) ?? null
})

const isSubIncident = computed(() => Boolean(props.incident?.parentId?.trim()))

const parentCrumbTitle = computed(() => {
  const parent = parentIncident.value
  if (parent) {
    return `${parent.incidentId} · ${parent.incidentTypeName} · ${parent.locationName}`
  }
  return props.incident?.parentId ?? undefined
})

function openParentIncident() {
  if (parentIncident.value) {
    openEditIncident(parentIncident.value)
  }
}

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

const dialogStyle = {
  width: 'min(100vw - 2rem, 84rem)',
  height: '90vh',
  maxHeight: '90vh',
} as const

const dialogContentStyle = {
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  minHeight: 0,
  overflow: 'hidden',
} as const

function close() {
  visible.value = false
}

function submit() {
  if (!props.incident) {
    return
  }

  const payload = editFormToIncidentUpdate(
    props.incident.incidentId,
    form,
    props.incident,
    config.value,
  )
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
    class="ic-sitrep-edit-dialog"
    :class="{ 'ic-sitrep-edit-dialog--sub': isSubIncident }"
    :style="dialogStyle"
    :content-style="dialogContentStyle"
    :draggable="false"
    :dismissable-mask="true"
    block-scroll
    content-class="ic-sitrep-edit-dialog__content"
    @hide="close"
  >
    <template #header>
      <nav
        v-if="incident && isSubIncident"
        class="ic-sitrep-edit-dialog__crumb"
        aria-label="Incidentgroep"
      >
        <button
          v-if="parentIncident"
          type="button"
          class="ic-sitrep-edit-dialog__crumb-link"
          :title="parentCrumbTitle"
          @click="openParentIncident"
        >
          {{ parentIncident.incidentId }}
        </button>
        <span
          v-else
          class="ic-sitrep-edit-dialog__crumb-muted"
          :title="parentCrumbTitle"
        >
          {{ incident.parentId }}
        </span>
        <i class="pi pi-angle-right ic-sitrep-edit-dialog__crumb-sep" aria-hidden="true" />
        <span class="ic-sitrep-edit-dialog__crumb-current">{{ incident.incidentId }}</span>
      </nav>
      <span v-else-if="incident" class="ic-sitrep-edit-dialog__title">
        {{ incident.incidentId }} bewerken
      </span>
      <span v-else class="ic-sitrep-edit-dialog__title">
        Incident
      </span>
    </template>

    <template v-if="incident">
      <div v-if="configLoading && !config" class="ic-sitrep-edit-dialog__loading">
        <Message severity="info" :closable="false">
          Configuratie laden…
        </Message>
      </div>

      <div v-else class="ic-sitrep-edit-dialog__body">
        <Tabs
          v-model:value="editTab"
          :class="[
            'ic-sitrep-edit-dialog__tabs',
            { 'ic-sitrep-edit-dialog__tabs--has-children': hasLinkedChildren },
          ]"
        >
          <TabList>
            <Tab value="form">
              <i class="pi pi-file-edit mr-1.5" aria-hidden="true" />
              Gegevens
            </Tab>
            <Tab v-if="hasLinkedChildren" value="children">
              <i class="pi pi-sitemap mr-1.5" aria-hidden="true" />
              <span class="ic-sitrep-edit-dialog__tab-label">Subtickets</span>
              <span class="ic-sitrep-edit-dialog__tab-badge">{{ linkedChildren.length }}</span>
            </Tab>
            <Tab value="updates" class="ic-sitrep-edit-dialog__tab-updates">
              <i class="pi pi-comments mr-1.5" aria-hidden="true" />
              Updates
            </Tab>
          </TabList>

          <TabPanels :lazy="false">
            <TabPanel value="form" class="ic-sitrep-edit-dialog__panel-main">
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
            Melding
          </h3>

          <IcFormField label="Korte omschrijving" html-for="sitrep-edit-description">
            <Textarea
              id="sitrep-edit-description"
              v-model="form.description"
              class="ic-field w-full"
              rows="3"
              auto-resize
            />
          </IcFormField>

          <IcFormField label="Tijdstempel" html-for="sitrep-edit-timestamp" class="mt-4">
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

          <template v-if="isEhbo">
            <IcFormField label="Aantal betrokkenen" html-for="sitrep-edit-persons" class="mt-4">
              <Select
                id="sitrep-edit-persons"
                v-model="form.personsInvolved"
                :options="config?.personsCountOptions ?? []"
                option-label="label"
                option-value="value"
                placeholder="Aantal"
                class="ic-field w-full"
              />
            </IcFormField>

            <IcFormField label="112 gebeld?" class="mt-4">
              <ChoiceButtons
                v-model="form.ambulanceCalled"
                :options="ambulanceOptions"
              />
            </IcFormField>
          </template>

          <IcFormField label="Prioriteit" class="mt-4">
            <ChoiceButtons
              v-model="form.priority"
              :options="priorityOptions"
              variant="priority"
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

          <Message
            v-if="hasLinkedChildren"
            severity="info"
            :closable="false"
            class="ic-sitrep-edit-dialog__children-hint mt-4"
          >
            {{ linkedChildren.length }} sub-incidenten gekoppeld
            ({{ linkedChildrenOpenCount }} open).
            <button
              type="button"
              class="ic-sitrep-edit-dialog__children-hint-link"
              @click="editTab = 'children'"
            >
              Bekijk sub-incidenten
            </button>
          </Message>
        </section>

              </div>
            </TabPanel>

            <TabPanel v-if="hasLinkedChildren" value="children" class="ic-sitrep-edit-dialog__panel-main">
              <SitrepIncidentList
                class="ic-sitrep-edit-dialog__sub-list"
                :incidents="linkedChildren"
                hide-filters
                :show-summary="false"
                row-variant="child"
                empty-message="Geen sub-incidenten"
              />
            </TabPanel>

            <TabPanel value="updates" class="ic-sitrep-edit-dialog__panel-updates">
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

    <template #footer class="mt-0 pt-0">
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
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
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
  .ic-sitrep-edit-dialog__tabs :deep(.ic-sitrep-edit-dialog__tab-updates) {
    display: none;
  }

  .ic-sitrep-edit-dialog__tabs:not(.ic-sitrep-edit-dialog__tabs--has-children) :deep(.p-tabpanel) {
    display: flex !important;
  }

  .ic-sitrep-edit-dialog__tabs--has-children :deep(.p-tablist) {
    display: flex;
  }

  .ic-sitrep-edit-dialog__tabs--has-children :deep(.ic-sitrep-edit-dialog__panel-main) {
    display: none !important;
    grid-column: 1;
    grid-row: 1;
  }

  .ic-sitrep-edit-dialog__tabs--has-children :deep(.ic-sitrep-edit-dialog__panel-main.p-tabpanel-active) {
    display: flex !important;
  }

  .ic-sitrep-edit-dialog__tabs--has-children :deep(.ic-sitrep-edit-dialog__panel-updates) {
    display: flex !important;
    grid-column: 2;
    grid-row: 1;
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

.ic-sitrep-edit-dialog__tab-label {
  margin-right: 0.25rem;
}

.ic-sitrep-edit-dialog__tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.3125rem;
  border-radius: 9999px;
  background: rgb(45 46 126 / 0.1);
  color: var(--ic-brand-dark);
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1;
}

.ic-sitrep-edit-dialog__tabs :deep(.p-tab.p-tab-active) .ic-sitrep-edit-dialog__tab-badge {
  background: rgb(249 115 22 / 0.15);
  color: #c2410c;
}

.ic-sitrep-edit-dialog__sub-list {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.ic-sitrep-edit-dialog__sub-list :deep(.ic-sitrep-list__scroll) {
  padding: 0 0.5rem 0 0;
}

.ic-sitrep-edit-dialog__children-hint :deep(.p-message-text) {
  font-size: 0.8125rem;
}

.ic-sitrep-edit-dialog__children-hint-link {
  margin-left: 0.25rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ic-brand);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.ic-sitrep-edit-dialog__children-hint-link:hover {
  color: var(--ic-brand-dark);
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

  .ic-sitrep-edit-dialog__sub-list :deep(.ic-sitrep-list__scroll) {
    padding: 0 0.5rem;
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

.ic-sitrep-edit-dialog__title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--ic-brand-dark);
}

.ic-sitrep-edit-dialog__crumb {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  max-width: 100%;
  font-size: 0.6875rem;
  line-height: 1.15;
  color: #64748b;
}

.ic-sitrep-edit-dialog__crumb-link {
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--ic-brand);
  text-decoration: underline;
  text-underline-offset: 0.125rem;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ic-sitrep-edit-dialog__crumb-link:hover {
  color: var(--ic-brand-dark);
}

.ic-sitrep-edit-dialog__crumb-link:focus-visible {
  outline: 2px solid var(--ic-brand);
  outline-offset: 2px;
  border-radius: 0.125rem;
}

.ic-sitrep-edit-dialog__crumb-muted {
  min-width: 0;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ic-sitrep-edit-dialog__crumb-sep {
  flex-shrink: 0;
  font-size: 0.625rem;
  color: #94a3b8;
}

.ic-sitrep-edit-dialog__crumb-current {
  flex-shrink: 0;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  color: var(--ic-brand-dark);
}
</style>

<style>
.ic-sitrep-edit-dialog.p-dialog {
  display: flex;
  flex-direction: column;
  height: 90vh !important;
  max-height: 90vh !important;
}

.ic-sitrep-edit-dialog.p-dialog .p-dialog-header {
  flex-shrink: 0;
}

.ic-sitrep-edit-dialog.p-dialog.ic-sitrep-edit-dialog--sub .p-dialog-header {
  padding-top: 0.375rem;
  padding-bottom: 0.375rem;
}

.ic-sitrep-edit-dialog.p-dialog .p-dialog-content,
.ic-sitrep-edit-dialog.p-dialog .ic-sitrep-edit-dialog__content {
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
