<script setup lang="ts">
import type { Incident, IncidentStatus, IncidentUpdate, IncidentUpdateEntry, Location } from '~/types/models'
import {
  expandLocationSectors,
  formatSector,
  locationOptions,
  parseSectorCode,
  RASTER_COLUMNS,
  RASTER_ROWS,
} from '~/utils/incidentOptions'
import { getLocationChangeForEntry } from '~/utils/incidentUpdateLocation'

const props = defineProps<{
  incident: Incident | null
  refreshKey?: number
}>()

const emit = defineEmits<{
  noteAdded: []
  updateDeleted: []
}>()

const { $api } = useNuxtApp()
const { updateIncident, refreshIncidents } = useSitrep()
const { displayName, fetchMe } = useStaffAuth()
const { markRead } = useIncidentFeedUnread()
const { fetchConfig, config } = useIncidents()

const entries = ref<IncidentUpdateEntry[]>([])
const loading = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)
const note = ref('')
const author = ref('')
const sectorCode = ref<string | null>(null)
const mapLocationId = ref<string | null>(null)
const rasterMapOpen = ref(false)
const feedRef = ref<HTMLElement | null>(null)

const confirmVisible = ref(false)
const deleteTarget = ref<IncidentUpdateEntry | null>(null)
const deletePreview = ref('')
const deleting = ref(false)

const locations = computed<Location[]>(() => config.value?.locations ?? [])

const locationSelectOptions = computed(() => locationOptions(locations.value))

const selectedLocation = computed(() =>
  mapLocationId.value
    ? locations.value.find(location => location.id === mapLocationId.value)
    : undefined,
)

const allowedSectors = computed(() => {
  if (!mapLocationId.value) {
    return null
  }
  return expandLocationSectors(
    selectedLocation.value,
    config.value?.raster.rows ?? RASTER_ROWS,
    config.value?.raster.columns ?? RASTER_COLUMNS,
  )
})

const currentSectorCode = computed(() => resolveIncidentSectorCode(props.incident))

const sectorChanged = computed(() => {
  const next = (sectorCode.value ?? '').trim().toUpperCase()
  const current = currentSectorCode.value.trim().toUpperCase()
  return Boolean(next) && next !== current
})

const locationChanged = computed(() => {
  if (mapLocationId.value == null) {
    return false
  }
  return mapLocationId.value !== (props.incident?.locationId ?? '')
})

const canSubmit = computed(() =>
  Boolean(note.value.trim() || sectorChanged.value || locationChanged.value) && !submitting.value,
)

const sectorButtonLabel = computed(() => {
  const selected = (sectorCode.value ?? '').trim().toUpperCase()
  if (!selected) {
    return 'Sector kiezen op kaart'
  }
  return `Sector ${selected} · wijzigen op kaart`
})

type FeedItem
  = | { kind: 'date', key: string, label: string }
    | { kind: 'status', key: string, entry: IncidentUpdateEntry }
    | { kind: 'location', key: string, entry: IncidentUpdateEntry, from: string, to: string }
    | { kind: 'message', key: string, entry: IncidentUpdateEntry, text: string }

function resolveIncidentSectorCode(incident: Incident | null): string {
  if (!incident) {
    return ''
  }
  if (incident.sectorRow && incident.sectorColumn) {
    return formatSector(incident.sectorRow, incident.sectorColumn)
  }
  const parsed = parseSectorCode(
    incident.sector,
    config.value?.raster.rows ?? RASTER_ROWS,
    config.value?.raster.columns ?? RASTER_COLUMNS,
  )
  return parsed?.code ?? ''
}

function syncLocationFromIncident() {
  // Do not preselect location — that would disable sectors outside its range.
  mapLocationId.value = null
  sectorCode.value = currentSectorCode.value || null
}

function resolveUpdateStatus(incident: Incident): IncidentStatus {
  const status = String(incident.status || 'Open').trim()
  if (status === 'Open' || status === 'In behandeling' || status === 'Afgesloten') {
    return status
  }
  return 'Open'
}

async function persistSectorChange(code: string) {
  if (!props.incident || submitting.value) {
    return
  }

  const rows = config.value?.raster.rows ?? RASTER_ROWS
  const columns = config.value?.raster.columns ?? RASTER_COLUMNS
  const parsedSector = parseSectorCode(code, rows, columns)

  if (!parsedSector) {
    error.value = 'Kies een geldige raster sector op de kaart'
    return
  }

  const nextCode = parsedSector.code
  const sectorDidChange = nextCode !== currentSectorCode.value.trim().toUpperCase()
  if (!sectorDidChange && !locationChanged.value) {
    sectorCode.value = nextCode
    return
  }

  submitting.value = true
  error.value = null

  try {
    const trimmedAuthor = author.value.trim()
    const trimmedNote = note.value.trim()
    const payload: IncidentUpdate = {
      incidentId: props.incident.incidentId,
      status: resolveUpdateStatus(props.incident),
      updateNotes: trimmedNote,
      updatedBy: trimmedAuthor || undefined,
      sectorRow: parsedSector.row,
      sectorColumn: parsedSector.column,
      sectorLabel: '',
    }

    if (locationChanged.value) {
      payload.locationId = mapLocationId.value || undefined
    }

    await updateIncident(payload)
    note.value = ''
    sectorCode.value = nextCode
    mapLocationId.value = null
    emit('noteAdded')
    await loadHistory()
    await markRead(props.incident.incidentId).catch(() => {})
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Sector opslaan mislukt'
  }
  finally {
    submitting.value = false
  }
}

async function onMapSectorSelect(code: string) {
  sectorCode.value = code
  await persistSectorChange(code)
}

function statusBadgeClass(status: IncidentStatus): string {
  switch (status) {
    case 'Open':
      return 'ic-update-feed__status--open'
    case 'In behandeling':
      return 'ic-update-feed__status--progress'
    case 'Afgesloten':
      return 'ic-update-feed__status--closed'
    default:
      return 'ic-update-feed__status--default'
  }
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDateSeparator(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)

  if (diffDays === 0) {
    return 'Vandaag'
  }
  if (diffDays === 1) {
    return 'Gisteren'
  }

  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function messageText(entry: IncidentUpdateEntry, index: number): string | null {
  if (entry.notes.trim()) {
    return entry.notes.trim()
  }
  if (index === 0) {
    return 'Incident geregistreerd'
  }
  if (entry.previousStatus && entry.status !== entry.previousStatus) {
    return null
  }
  return null
}

function statusChanged(entry: IncidentUpdateEntry): boolean {
  return Boolean(entry.previousStatus && entry.status !== entry.previousStatus)
}

function locationChange(entry: IncidentUpdateEntry, index: number) {
  return getLocationChangeForEntry(entries.value, index, locations.value)
}

function isVisibleInFeed(entry: IncidentUpdateEntry, index: number): boolean {
  return statusChanged(entry)
    || locationChange(entry, index) !== null
    || messageText(entry, index) !== null
}

const visibleEntryCount = computed(() =>
  entries.value.filter((entry, index) => isVisibleInFeed(entry, index)).length,
)

function entryIndex(entry: IncidentUpdateEntry): number {
  return entries.value.findIndex(item => item.id === entry.id)
}

function deletePreviewLabel(entry: IncidentUpdateEntry): string {
  const index = entryIndex(entry)
  if (statusChanged(entry)) {
    return `Statuswijziging: ${entry.previousStatus} → ${entry.status}`
  }
  const change = index >= 0 ? locationChange(entry, index) : null
  if (change) {
    return `Locatie: ${change.from} → ${change.to}`
  }
  const text = index >= 0 ? messageText(entry, index) : entry.notes.trim()
  return text || 'Update'
}

function askDelete(entry: IncidentUpdateEntry, kind: 'status' | 'location' | 'message' = 'message') {
  deleteTarget.value = entry
  const index = entryIndex(entry)
  if (kind === 'location') {
    const change = index >= 0 ? locationChange(entry, index) : null
    deletePreview.value = change
      ? `Locatie: ${change.from} → ${change.to}`
      : deletePreviewLabel(entry)
  }
  else if (kind === 'status' && statusChanged(entry)) {
    deletePreview.value = `Statuswijziging: ${entry.previousStatus} → ${entry.status}`
  }
  else {
    deletePreview.value = deletePreviewLabel(entry)
  }
  confirmVisible.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value || deleting.value) {
    return
  }

  const deletedId = deleteTarget.value.id
  deleting.value = true
  error.value = null

  try {
    await $api.incidents.deleteUpdate(deletedId)
    entries.value = entries.value.filter(entry => entry.id !== deletedId)
    confirmVisible.value = false
    deleteTarget.value = null
    emit('updateDeleted')
    await refreshIncidents()
    await loadHistory()
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Update verwijderen mislukt'
    confirmVisible.value = false
    await loadHistory()
  }
  finally {
    deleting.value = false
  }
}

const feedItems = computed<FeedItem[]>(() => {
  const items: FeedItem[] = []
  let lastDateKey = ''

  entries.value.forEach((entry, index) => {
    if (!isVisibleInFeed(entry, index)) {
      return
    }

    const dateKey = entry.createdAt.slice(0, 10)
    if (dateKey !== lastDateKey) {
      items.push({
        kind: 'date',
        key: `date-${dateKey}`,
        label: formatDateSeparator(entry.createdAt),
      })
      lastDateKey = dateKey
    }

    if (statusChanged(entry)) {
      items.push({
        kind: 'status',
        key: `status-${entry.id}`,
        entry,
      })
    }

    const change = locationChange(entry, index)
    if (change) {
      items.push({
        kind: 'location',
        key: `location-${entry.id}`,
        entry,
        from: change.from,
        to: change.to,
      })
    }

    const text = messageText(entry, index)
    if (text) {
      items.push({
        kind: 'message',
        key: `message-${entry.id}`,
        entry,
        text,
      })
    }
  })

  return items
})

async function loadHistory() {
  if (!props.incident) {
    entries.value = []
    error.value = null
    return
  }

  loading.value = true
  error.value = null

  try {
    const response = await $api.incidents.getUpdateHistory(props.incident.incidentId)
    entries.value = response.data ?? []
    await nextTick()
    scrollToBottom()
  }
  catch (err: unknown) {
    entries.value = []
    error.value = err instanceof Error ? err.message : 'Updates laden mislukt'
  }
  finally {
    loading.value = false
  }
}

function scrollToBottom() {
  if (!feedRef.value) {
    return
  }
  feedRef.value.scrollTop = feedRef.value.scrollHeight
}

async function submitNote() {
  if (!props.incident || submitting.value || !canSubmit.value) {
    return
  }

  const trimmedNote = note.value.trim()
  const rows = config.value?.raster.rows ?? RASTER_ROWS
  const columns = config.value?.raster.columns ?? RASTER_COLUMNS
  const parsedSector = parseSectorCode(sectorCode.value, rows, columns)

  if (sectorChanged.value && !parsedSector) {
    error.value = 'Kies een geldige raster sector op de kaart'
    return
  }

  // Sector-only changes are saved when confirming on the map.
  if (!trimmedNote && sectorChanged.value && parsedSector) {
    await persistSectorChange(parsedSector.code)
    return
  }

  submitting.value = true
  error.value = null

  try {
    const trimmedAuthor = author.value.trim()
    const payload: IncidentUpdate = {
      incidentId: props.incident.incidentId,
      status: resolveUpdateStatus(props.incident),
      updateNotes: trimmedNote,
      updatedBy: trimmedAuthor || undefined,
    }

    if (sectorChanged.value && parsedSector) {
      payload.sectorRow = parsedSector.row
      payload.sectorColumn = parsedSector.column
      payload.sectorLabel = ''
    }

    if (locationChanged.value) {
      payload.locationId = mapLocationId.value || undefined
    }

    await updateIncident(payload)
    note.value = ''
    if (parsedSector) {
      sectorCode.value = parsedSector.code
    }
    mapLocationId.value = null
    emit('noteAdded')
    await loadHistory()
    await markRead(props.incident.incidentId).catch(() => {})
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Update opslaan mislukt'
  }
  finally {
    submitting.value = false
  }
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submitNote()
  }
}

watch(
  () => [props.incident?.incidentId, props.incident?.sector, props.incident?.sectorRow, props.incident?.sectorColumn, props.incident?.locationId, props.refreshKey] as const,
  async () => {
    await Promise.all([
      fetchMe().catch(() => {}),
      fetchConfig().catch(() => {}),
    ])
    author.value = displayName.value || props.incident?.actionOwner || ''
    syncLocationFromIncident()
    loadHistory()
  },
  { immediate: true },
)

watch(displayName, (name) => {
  if (name && !author.value.trim()) {
    author.value = name
  }
})
</script>

<template>
  <section class="ic-update-feed" aria-label="Incidentupdates">
    <header class="ic-update-feed__header">
      <h3 class="ic-update-feed__title">
        Updates
      </h3>
      <span v-if="incident" class="ic-update-feed__count">
        {{ visibleEntryCount }}
      </span>
    </header>

    <div ref="feedRef" class="ic-update-feed__messages">
      <div v-if="loading" class="ic-update-feed__state">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        <span>Updates laden…</span>
      </div>

      <Message v-else-if="error && entries.length === 0" severity="warn" :closable="false">
        {{ error }}
      </Message>

      <p v-else-if="!incident" class="ic-update-feed__state">
        Geen incident geselecteerd
      </p>

      <p v-else-if="feedItems.length === 0" class="ic-update-feed__state">
        Nog geen updates. Voeg hieronder een notitie toe.
      </p>

      <template v-else>
        <template v-for="item in feedItems" :key="item.key">
          <div v-if="item.kind === 'date'" class="ic-update-feed__date">
            <span>{{ item.label }}</span>
          </div>

          <div
            v-else-if="item.kind === 'status'"
            class="ic-update-feed__system"
          >
            <div class="ic-update-feed__item-actions">
              <span :class="['ic-update-feed__status', statusBadgeClass(item.entry.status)]">
                {{ item.entry.previousStatus }} → {{ item.entry.status }}
              </span>
              <button
                type="button"
                class="ic-update-feed__delete"
                aria-label="Statusupdate verwijderen"
                title="Verwijderen"
                :disabled="deleting"
                @click="askDelete(item.entry, 'status')"
              >
                <i class="pi pi-trash" aria-hidden="true" />
              </button>
            </div>
            <footer v-if="item.entry.updatedBy" class="ic-update-feed__system-meta">
              <span class="ic-update-feed__author">{{ item.entry.updatedBy }}</span>
              <time>{{ formatTime(item.entry.createdAt) }}</time>
            </footer>
            <time v-else>{{ formatTime(item.entry.createdAt) }}</time>
          </div>

          <div
            v-else-if="item.kind === 'location'"
            class="ic-update-feed__system"
          >
            <div class="ic-update-feed__item-actions">
              <span class="ic-update-feed__location">
                Locatie gewijzigd: {{ item.from }} → {{ item.to }}
              </span>
              <button
                type="button"
                class="ic-update-feed__delete"
                aria-label="Locatie-update verwijderen"
                title="Verwijderen"
                :disabled="deleting"
                @click="askDelete(item.entry, 'location')"
              >
                <i class="pi pi-trash" aria-hidden="true" />
              </button>
            </div>
            <footer v-if="item.entry.updatedBy" class="ic-update-feed__system-meta">
              <span class="ic-update-feed__author">{{ item.entry.updatedBy }}</span>
              <time>{{ formatTime(item.entry.createdAt) }}</time>
            </footer>
            <time v-else>{{ formatTime(item.entry.createdAt) }}</time>
          </div>

          <article
            v-else
            class="ic-update-feed__bubble"
          >
            <div class="ic-update-feed__bubble-head">
              <p class="ic-update-feed__text">
                {{ item.text }}
              </p>
              <button
                type="button"
                class="ic-update-feed__delete"
                aria-label="Update verwijderen"
                title="Verwijderen"
                :disabled="deleting"
                @click="askDelete(item.entry, 'message')"
              >
                <i class="pi pi-trash" aria-hidden="true" />
              </button>
            </div>
            <footer class="ic-update-feed__meta">
              <span v-if="item.entry.updatedBy" class="ic-update-feed__author">
                {{ item.entry.updatedBy }}
              </span>
              <time>{{ formatTime(item.entry.createdAt) }}</time>
            </footer>
          </article>
        </template>
      </template>
    </div>

    <form
      v-if="incident"
      class="ic-update-feed__composer"
      @submit.prevent="submitNote"
    >
      <Message v-if="error && entries.length > 0" severity="warn" :closable="false" class="ic-update-feed__composer-error">
        {{ error }}
      </Message>

      <InputText
        v-model="author"
        class="ic-update-feed__author-input"
        placeholder="Naam"
        :disabled="submitting"
      />

      <button
        type="button"
        class="ic-update-feed__map-btn"
        :disabled="submitting"
        @click="rasterMapOpen = true"
      >
        <i class="pi pi-map" aria-hidden="true" />
        <span>{{ sectorButtonLabel }}</span>
      </button>

      <RasterMapDialog
        v-model="rasterMapOpen"
        v-model:location-id="mapLocationId"
        :location-options="locationSelectOptions"
        :selected-sector="sectorCode"
        :allowed-sectors="allowedSectors"
        @select="onMapSectorSelect"
      />

      <div class="ic-update-feed__composer-row">
        <Textarea
          v-model="note"
          class="ic-update-feed__input"
          rows="2"
          auto-resize
          placeholder="Typ een update…"
          :disabled="submitting"
          @keydown="handleComposerKeydown"
        />
        <Button
          type="submit"
          icon="pi pi-send"
          aria-label="Update versturen"
          :loading="submitting"
          :disabled="!canSubmit"
        />
      </div>
    </form>

    <Dialog
      v-model:visible="confirmVisible"
      modal
      header="Update verwijderen?"
      class="w-full max-w-sm"
      :dismissable-mask="true"
    >
      <p class="text-sm text-slate-700">
        Weet je zeker dat je deze update wilt verwijderen?
      </p>
      <p class="mt-2 rounded-lg border border-[rgb(135_161_198/0.35)] bg-slate-50 px-3 py-2 text-sm text-[var(--ic-brand-dark)]">
        {{ deletePreview }}
      </p>
      <p
        v-if="entries.length === 1"
        class="mt-2 text-xs text-slate-500"
      >
        Dit is de enige update voor dit incident. Het incident zelf blijft bestaan.
      </p>
      <template #footer>
        <Button
          label="Annuleren"
          severity="secondary"
          text
          :disabled="deleting"
          @click="confirmVisible = false"
        />
        <Button
          label="Verwijderen"
          severity="danger"
          icon="pi pi-trash"
          :loading="deleting"
          @click="confirmDelete"
        />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.ic-update-feed {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  border-radius: 0.5rem;
  background: #f8fafc;
  border: 1px solid rgb(135 161 198 / 0.35);
}

.ic-update-feed__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid rgb(135 161 198 / 0.25);
  background: rgb(255 255 255 / 0.75);
}

.ic-update-feed__title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ic-brand-dark);
}

.ic-update-feed__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.375rem;
  height: 1.375rem;
  padding: 0 0.375rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--ic-brand-dark);
  background: rgb(135 161 198 / 0.2);
}

.ic-update-feed__messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.ic-update-feed__state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #64748b;
}

.ic-update-feed__date {
  display: flex;
  justify-content: center;
  margin: 0.25rem 0;
}

.ic-update-feed__date span {
  padding: 0.1875rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #64748b;
  background: rgb(148 163 184 / 0.18);
}

.ic-update-feed__system {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  margin: 0.125rem 0;
  font-size: 0.6875rem;
  color: #64748b;
}

.ic-update-feed__item-actions,
.ic-update-feed__bubble-head {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  width: 100%;
}

.ic-update-feed__item-actions {
  justify-content: center;
}

.ic-update-feed__bubble-head {
  justify-content: space-between;
}

.ic-update-feed__delete {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.625rem;
  height: 1.625rem;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.ic-update-feed__delete:hover,
.ic-update-feed__delete:focus-visible {
  color: var(--ic-crimson);
  background: rgb(186 49 72 / 0.08);
  outline: none;
}

.ic-update-feed__delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ic-update-feed__system-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.375rem 0.625rem;
}

.ic-update-feed__status {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.ic-update-feed__status--open {
  background: rgb(34 197 94 / 0.15);
  color: #15803d;
}

.ic-update-feed__status--progress {
  background: rgb(249 115 22 / 0.15);
  color: #c2410c;
}

.ic-update-feed__status--closed {
  background: rgb(148 163 184 / 0.25);
  color: #475569;
}

.ic-update-feed__status--default {
  background: rgb(135 161 198 / 0.2);
  color: var(--ic-brand-dark);
}

.ic-update-feed__location {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-align: center;
  background: rgb(45 46 126 / 0.1);
  color: var(--ic-brand-dark);
}

.ic-update-feed__bubble {
  align-self: flex-start;
  max-width: 92%;
  padding: 0.625rem 0.75rem;
  border-radius: 0.75rem 0.75rem 0.75rem 0.25rem;
  background: #fff;
  border: 1px solid rgb(135 161 198 / 0.25);
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
}

.ic-update-feed__text {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: #1e293b;
  white-space: pre-wrap;
}

.ic-update-feed__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.375rem 0.625rem;
  margin-top: 0.375rem;
  font-size: 0.6875rem;
  color: #64748b;
}

.ic-update-feed__author {
  font-weight: 600;
  margin-right: auto;
}

.ic-update-feed__composer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid rgb(135 161 198 / 0.25);
  background: rgb(255 255 255 / 0.9);
}

.ic-update-feed__composer-error {
  margin: 0;
}

.ic-update-feed__author-input {
  width: 100%;
}

.ic-update-feed__map-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgb(135 161 198 / 0.45);
  border-radius: 0.5rem;
  background: #fff;
  color: var(--ic-brand-dark);
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.ic-update-feed__map-btn:hover:not(:disabled),
.ic-update-feed__map-btn:focus-visible {
  border-color: var(--ic-brand);
  color: var(--ic-brand);
  background: rgb(45 46 126 / 0.04);
  outline: none;
}

.ic-update-feed__map-btn--changed {
  border-color: var(--ic-orange);
  color: var(--ic-brand);
  background: rgb(230 151 50 / 0.08);
}

.ic-update-feed__map-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ic-update-feed__composer-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.ic-update-feed__input {
  flex: 1;
  min-width: 0;
}

.ic-update-feed__composer :deep(.p-inputtext),
.ic-update-feed__composer :deep(.p-textarea) {
  width: 100%;
  font-size: 0.875rem;
}
</style>
