<script setup lang="ts">
import type { Location, SectorRange } from '~/types/models'
import { LOCATION_ZONES, useAdminLocations } from '~/composables/useAdminLocations'
import { expandLocationSectors } from '~/utils/incidentOptions'

useHead({ title: 'Locaties — Admin — IC2026 DV' })

const { listLocations, addLocation, updateLocation } = useAdminLocations()
const { fetchConfig } = useIncidents()
const { fetchMe } = useStaffAuth()

const rows = ref<Location[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const name = ref('')
const zone = ref('hal')
const active = ref(true)
const addRanges = ref<SectorRange[]>([])
const adding = ref(false)
const addError = ref<string | null>(null)

const editVisible = ref(false)
const editRow = ref<Location | null>(null)
const editName = ref('')
const editZone = ref('hal')
const editActive = ref(true)
const editRanges = ref<SectorRange[]>([])
const savingEdit = ref(false)
const editError = ref<string | null>(null)

const zoneOptions = LOCATION_ZONES.map(z => ({ value: z.value, label: z.label }))

function zoneLabel(value: string): string {
  return LOCATION_ZONES.find(z => z.value === value)?.label ?? value
}

function emptyRange(): SectorRange {
  return { from: '', to: '' }
}

function cloneRanges(ranges: SectorRange[] | undefined): SectorRange[] {
  return (ranges ?? []).map(r => ({ from: r.from, to: r.to }))
}

function sectorSummary(location: Location): string {
  const ranges = location.sectorRanges ?? []
  if (!ranges.length) {
    return 'Alle sectoren'
  }
  const expanded = expandLocationSectors(location)
  const count = expanded?.length ?? 0
  if (ranges.length === 1) {
    return `${ranges[0]!.from}–${ranges[0]!.to} · ${count} sectoren`
  }
  return `${ranges.length} bereiken · ${count} sectoren`
}

function rangePreview(ranges: SectorRange[]): string {
  const expanded = expandLocationSectors({
    id: '',
    name: '',
    zone: '',
    active: true,
    sectorRanges: ranges.filter(r => r.from.trim() && r.to.trim()),
  })
  if (!ranges.some(r => r.from.trim() || r.to.trim())) {
    return 'Geen bereiken → alle sectoren zichtbaar'
  }
  if (!expanded?.length) {
    return 'Ongeldige of onvolledige bereiken'
  }
  return `${expanded.length} sectoren in selectie`
}

const addRangePreview = computed(() => rangePreview(addRanges.value))
const editRangePreview = computed(() => rangePreview(editRanges.value))

async function refreshIncidentConfig() {
  await fetchConfig(true).catch(() => {})
}

async function load() {
  loading.value = true
  error.value = null
  try {
    await fetchMe(true)
    rows.value = await listLocations()
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

async function onAdd() {
  addError.value = null
  adding.value = true
  try {
    await addLocation({
      name: name.value,
      zone: zone.value,
      active: active.value,
      sectorRanges: addRanges.value,
    })
    name.value = ''
    zone.value = 'hal'
    active.value = true
    addRanges.value = []
    await load()
    await refreshIncidentConfig()
  }
  catch (err) {
    addError.value = err instanceof Error ? err.message : 'Toevoegen mislukt'
  }
  finally {
    adding.value = false
  }
}

function openEdit(row: Location) {
  editRow.value = row
  editName.value = row.name
  editZone.value = row.zone || 'hal'
  editActive.value = row.active
  editRanges.value = cloneRanges(row.sectorRanges)
  editError.value = null
  editVisible.value = true
}

async function saveEdit() {
  if (!editRow.value) return
  editError.value = null
  savingEdit.value = true
  try {
    await updateLocation({
      id: editRow.value.id,
      name: editName.value,
      zone: editZone.value,
      active: editActive.value,
      sectorRanges: editRanges.value,
    })
    editVisible.value = false
    await load()
    await refreshIncidentConfig()
  }
  catch (err) {
    editError.value = err instanceof Error ? err.message : 'Opslaan mislukt'
  }
  finally {
    savingEdit.value = false
  }
}

async function toggleActive(row: Location) {
  error.value = null
  try {
    await updateLocation({
      id: row.id,
      name: row.name,
      zone: row.zone,
      active: !row.active,
      sectorRanges: row.sectorRanges ?? [],
    })
    await load()
    await refreshIncidentConfig()
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Status wijzigen mislukt'
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

    <section class="ic-card space-y-4">
      <h2 class="ic-section-heading mb-0">
        Nieuwe locatie
      </h2>
      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="onAdd">
        <div class="sm:col-span-2">
          <label class="ic-label" for="loc-name">Naam</label>
          <InputText
            id="loc-name"
            v-model="name"
            class="ic-field"
            placeholder="bijv. Hal 12 (NL)"
            required
          />
        </div>
        <div>
          <label class="ic-label" for="loc-zone">Zone</label>
          <Select
            id="loc-zone"
            v-model="zone"
            :options="zoneOptions"
            option-label="label"
            option-value="value"
            class="ic-field w-full"
          />
        </div>
        <div class="flex items-end pb-1">
          <div class="flex items-center gap-2">
            <Checkbox
              v-model="active"
              input-id="loc-active"
              binary
            />
            <label for="loc-active" class="text-sm text-slate-700">
              Actief (zichtbaar in formulieren)
            </label>
          </div>
        </div>

        <div class="sm:col-span-2 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <label class="ic-label mb-0">Sectorbereiken</label>
            <Button
              type="button"
              label="Bereik toevoegen"
              icon="pi pi-plus"
              size="small"
              severity="secondary"
              outlined
              @click="addRanges.push(emptyRange())"
            />
          </div>
          <p class="text-xs text-slate-500">
            Hoeken van een rechthoek op het raster, bijv. A1 tot C8 (= 24 sectoren). Leeg = alle sectoren.
          </p>
          <div
            v-for="(range, index) in addRanges"
            :key="`add-range-${index}`"
            class="flex flex-wrap items-end gap-2"
          >
            <div class="min-w-[5.5rem] flex-1">
              <label class="ic-label" :for="`add-from-${index}`">Van</label>
              <InputText
                :id="`add-from-${index}`"
                v-model="range.from"
                class="ic-field"
                placeholder="A1"
              />
            </div>
            <div class="min-w-[5.5rem] flex-1">
              <label class="ic-label" :for="`add-to-${index}`">Tot</label>
              <InputText
                :id="`add-to-${index}`"
                v-model="range.to"
                class="ic-field"
                placeholder="C8"
              />
            </div>
            <Button
              type="button"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              aria-label="Bereik verwijderen"
              @click="addRanges.splice(index, 1)"
            />
          </div>
          <p class="text-sm font-medium text-slate-600">
            {{ addRangePreview }}
          </p>
        </div>

        <Message
          v-if="addError"
          class="sm:col-span-2"
          severity="error"
          :closable="false"
        >
          {{ addError }}
        </Message>
        <div class="sm:col-span-2">
          <Button
            type="submit"
            label="Locatie toevoegen"
            icon="pi pi-plus"
            :loading="adding"
          />
        </div>
      </form>
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="ic-section-heading mb-0">
          Lijst
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

      <div
        v-if="loading && !rows.length"
        class="py-8 text-center text-sm text-slate-500"
      >
        Laden…
      </div>

      <ul
        v-else
        class="divide-y rounded-xl border border-[rgb(135_161_198/0.45)] bg-white"
      >
        <li
          v-for="row in rows"
          :key="row.id"
          class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          :class="{ 'opacity-60': !row.active }"
        >
          <div>
            <p class="font-medium text-[var(--ic-brand-dark)]">
              {{ row.name }}
              <span
                v-if="!row.active"
                class="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >Inactief</span>
            </p>
            <p class="text-sm text-slate-600">
              {{ zoneLabel(row.zone) }}
            </p>
            <p class="text-sm text-slate-600">
              {{ sectorSummary(row) }}
            </p>
            <p class="text-xs text-slate-500">
              {{ row.id }}
            </p>
          </div>
          <div class="flex gap-2">
            <Button
              :label="row.active ? 'Deactiveren' : 'Activeren'"
              :icon="row.active ? 'pi pi-eye-slash' : 'pi pi-eye'"
              size="small"
              severity="secondary"
              outlined
              @click="toggleActive(row)"
            />
            <Button
              label="Bewerken"
              icon="pi pi-pencil"
              size="small"
              severity="secondary"
              outlined
              @click="openEdit(row)"
            />
          </div>
        </li>
        <li
          v-if="!rows.length"
          class="px-4 py-8 text-center text-sm text-slate-500"
        >
          Nog geen locaties. Voeg hierboven een locatie toe.
        </li>
      </ul>
    </section>
  </div>

  <Dialog
    v-model:visible="editVisible"
    modal
    header="Locatie bewerken"
    class="w-full max-w-md"
    :dismissable-mask="true"
  >
    <div class="space-y-3">
      <div>
        <label class="ic-label" for="edit-loc-name">Naam</label>
        <InputText
          id="edit-loc-name"
          v-model="editName"
          class="ic-field"
        />
      </div>
      <div>
        <label class="ic-label" for="edit-loc-zone">Zone</label>
        <Select
          id="edit-loc-zone"
          v-model="editZone"
          :options="zoneOptions"
          option-label="label"
          option-value="value"
          class="ic-field w-full"
        />
      </div>
      <div class="flex items-center gap-2">
        <Checkbox
          v-model="editActive"
          input-id="edit-loc-active"
          binary
        />
        <label for="edit-loc-active" class="text-sm text-slate-700">
          Actief (zichtbaar in formulieren)
        </label>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <label class="ic-label mb-0">Sectorbereiken</label>
          <Button
            type="button"
            label="Bereik toevoegen"
            icon="pi pi-plus"
            size="small"
            severity="secondary"
            outlined
            @click="editRanges.push(emptyRange())"
          />
        </div>
        <p class="text-xs text-slate-500">
          Hoeken van een rechthoek, bijv. A1 tot C8. Leeg = alle sectoren.
        </p>
        <div
          v-for="(range, index) in editRanges"
          :key="`edit-range-${index}`"
          class="flex flex-wrap items-end gap-2"
        >
          <div class="min-w-[5.5rem] flex-1">
            <label class="ic-label" :for="`edit-from-${index}`">Van</label>
            <InputText
              :id="`edit-from-${index}`"
              v-model="range.from"
              class="ic-field"
              placeholder="A1"
            />
          </div>
          <div class="min-w-[5.5rem] flex-1">
            <label class="ic-label" :for="`edit-to-${index}`">Tot</label>
            <InputText
              :id="`edit-to-${index}`"
              v-model="range.to"
              class="ic-field"
              placeholder="C8"
            />
          </div>
          <Button
            type="button"
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            aria-label="Bereik verwijderen"
            @click="editRanges.splice(index, 1)"
          />
        </div>
        <p class="text-sm font-medium text-slate-600">
          {{ editRangePreview }}
        </p>
      </div>

      <Message
        v-if="editError"
        severity="error"
        :closable="false"
      >
        {{ editError }}
      </Message>
    </div>
    <template #footer>
      <Button
        label="Annuleren"
        severity="secondary"
        text
        @click="editVisible = false"
      />
      <Button
        label="Opslaan"
        icon="pi pi-save"
        :loading="savingEdit"
        @click="saveEdit"
      />
    </template>
  </Dialog>
</template>
