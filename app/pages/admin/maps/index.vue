<script setup lang="ts">
import type { RasterMapDefinition } from '~/types/models'
import { BUNDLED_RASTER_ASSET_PATH } from '~/constants/defaultRasterMap'
import { RASTER_MAP_GRID_BOUNDS } from '~/constants/rasterMapGrid'
import { useAdminRasterMaps } from '~/composables/useAdminRasterMaps'

useHead({ title: 'Kaarten — Admin — IC2026 DV' })

const { listMaps, addMap, setDefault, updateMap, deleteMap, uploadImage } = useAdminRasterMaps()
const { fetchConfig } = useIncidents()

const rows = ref<RasterMapDefinition[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const name = ref('')
const addFile = ref<File | null>(null)
const useBundled = ref(true)
const adding = ref(false)
const addError = ref<string | null>(null)

async function refresh() {
  loading.value = true
  error.value = null
  try {
    rows.value = await listMaps()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Laden mislukt'
  }
  finally {
    loading.value = false
  }
}

async function refreshConfig() {
  await fetchConfig(true).catch(() => {})
}

onMounted(refresh)

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  addFile.value = input.files?.[0] ?? null
  if (addFile.value) {
    useBundled.value = false
  }
}

async function onAdd() {
  adding.value = true
  addError.value = null
  try {
    let imagePath = BUNDLED_RASTER_ASSET_PATH
    const created = await addMap({
      name: name.value,
      imagePath,
      gridBounds: { ...RASTER_MAP_GRID_BOUNDS },
      isDefault: rows.value.length === 0,
    })

    if (!useBundled.value && addFile.value) {
      imagePath = await uploadImage(addFile.value, created.id)
      await updateMap(created.id, { imagePath })
    }

    name.value = ''
    addFile.value = null
    useBundled.value = true
    await refresh()
    await refreshConfig()
  }
  catch (e) {
    addError.value = e instanceof Error ? e.message : 'Opslaan mislukt'
  }
  finally {
    adding.value = false
  }
}

async function onSetDefault(id: string) {
  try {
    await setDefault(id)
    await refresh()
    await refreshConfig()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Mislukt'
  }
}

async function onToggleActive(map: RasterMapDefinition) {
  try {
    if (map.isDefault && map.active) {
      error.value = 'Standaardkaart kan niet gedeactiveerd worden'
      return
    }
    await updateMap(map.id, { active: !map.active })
    await refresh()
    await refreshConfig()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Mislukt'
  }
}

async function onDelete(map: RasterMapDefinition) {
  if (!confirm(`Kaart “${map.name}” verwijderen?`)) return
  try {
    await deleteMap(map.id)
    await refresh()
    await refreshConfig()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Verwijderen mislukt'
  }
}

function formatUpdated(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('nl-NL')
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

    <p class="text-sm text-slate-600">
      Beheer venue-kaarten: rasterpositie op de PNG en GPS-ankers voor OpenStreetMap.
    </p>

    <section class="ic-card space-y-4">
      <h2 class="ic-section-heading mb-0">
        Nieuwe kaart
      </h2>
      <form
        class="grid gap-3 sm:grid-cols-2"
        @submit.prevent="onAdd"
      >
        <div class="sm:col-span-2">
          <label
            class="ic-label"
            for="map-name"
          >Naam</label>
          <InputText
            id="map-name"
            v-model="name"
            class="ic-field"
            placeholder="bijv. Jaarbeurs 2027"
            required
          />
        </div>
        <div class="sm:col-span-2">
          <label class="ic-label" for="map-file">PNG upload (optioneel)</label>
          <input
            id="map-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="mt-1 text-sm"
            @change="onFileChange"
          >
        </div>
        <div class="sm:col-span-2 flex items-center gap-2">
          <Checkbox
            v-model="useBundled"
            input-id="map-bundled"
            binary
            :disabled="!!addFile"
          />
          <label
            for="map-bundled"
            class="text-sm text-slate-700"
          >
            Gebruik gebundelde raster-map.png
          </label>
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
            label="Toevoegen"
            icon="pi pi-plus"
            :loading="adding"
            :disabled="!name.trim()"
          />
        </div>
      </form>
    </section>

    <section class="ic-card space-y-4">
      <h2 class="ic-section-heading mb-0">
        Kaarten
      </h2>
      <p
        v-if="loading"
        class="text-sm text-slate-500"
      >
        Laden…
      </p>
      <p
        v-else-if="!rows.length"
        class="text-sm text-slate-500"
      >
        Geen kaarten.
      </p>
      <ul
        v-else
        class="ic-admin-maps__list"
      >
        <li
          v-for="map in rows"
          :key="map.id"
          class="ic-admin-maps__row"
        >
          <img
            :src="map.imageUrl"
            :alt="map.name"
            class="ic-admin-maps__thumb"
          >
          <div class="min-w-0">
            <p class="font-semibold text-[var(--ic-brand-dark)]">
              {{ map.name }}
              <Tag
                v-if="map.isDefault"
                value="Standaard"
                severity="warn"
                class="ml-2"
              />
              <Tag
                v-if="!map.active"
                value="Inactief"
                severity="secondary"
                class="ml-2"
              />
            </p>
            <p class="text-xs text-slate-500">
              {{ map.id }} · bijgewerkt {{ formatUpdated(map.updatedAt) }}
            </p>
          </div>
          <div class="ic-admin-maps__actions">
            <Button
              as="router-link"
              :to="`/admin/maps/${map.id}`"
              label="Bewerken"
              size="small"
              outlined
            />
            <Button
              v-if="!map.isDefault"
              type="button"
              label="Maak standaard"
              size="small"
              text
              @click="onSetDefault(map.id)"
            />
            <Button
              type="button"
              :label="map.active ? 'Deactiveer' : 'Activeer'"
              size="small"
              text
              @click="onToggleActive(map)"
            />
            <Button
              v-if="!map.isDefault"
              type="button"
              label="Verwijder"
              size="small"
              severity="danger"
              text
              @click="onDelete(map)"
            />
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.ic-admin-maps__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ic-admin-maps__row {
  display: grid;
  grid-template-columns: 4.5rem 1fr;
  gap: 0.75rem 1rem;
  align-items: start;
  padding: 0.75rem;
  border: 1px solid rgb(135 161 198 / 0.35);
  border-radius: 0.75rem;
  background: #fff;
}

@media (min-width: 640px) {
  .ic-admin-maps__row {
    grid-template-columns: 5rem 1fr auto;
    align-items: center;
  }
}

.ic-admin-maps__thumb {
  width: 4.5rem;
  height: 4rem;
  object-fit: cover;
  border-radius: 0.375rem;
  border: 1px solid rgb(135 161 198 / 0.3);
}

.ic-admin-maps__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
  grid-column: 1 / -1;
}

@media (min-width: 640px) {
  .ic-admin-maps__actions {
    grid-column: auto;
    justify-content: flex-end;
  }
}
</style>
