<script setup lang="ts">
import type { Department } from '~/types/models'
import {
  DEPARTMENT_OPTIONS,
  useAdminIncidentTypes,
  type AdminIncidentType,
} from '~/composables/useAdminIncidentTypes'

useHead({ title: 'Incidenttypes — Admin — IC2026 DV' })

const { listIncidentTypes, addIncidentType, updateIncidentType } = useAdminIncidentTypes()
const { fetchConfig } = useIncidents()
const { fetchMe } = useStaffAuth()

const rows = ref<AdminIncidentType[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const name = ref('')
const department = ref<Department>('Dienstverlening')
const active = ref(true)
const adding = ref(false)
const addError = ref<string | null>(null)

const editVisible = ref(false)
const editRow = ref<AdminIncidentType | null>(null)
const editName = ref('')
const editDepartment = ref<Department>('Dienstverlening')
const editActive = ref(true)
const savingEdit = ref(false)
const editError = ref<string | null>(null)

const departmentOptions = DEPARTMENT_OPTIONS

async function refreshIncidentConfig() {
  await fetchConfig(true).catch(() => {})
}

async function load() {
  loading.value = true
  error.value = null
  try {
    await fetchMe(true)
    rows.value = await listIncidentTypes()
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
    await addIncidentType({
      name: name.value,
      department: department.value,
      active: active.value,
    })
    name.value = ''
    department.value = 'Dienstverlening'
    active.value = true
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

function openEdit(row: AdminIncidentType) {
  editRow.value = row
  editName.value = row.name
  editDepartment.value = row.department
  editActive.value = row.active
  editError.value = null
  editVisible.value = true
}

async function saveEdit() {
  if (!editRow.value) return
  editError.value = null
  savingEdit.value = true
  try {
    await updateIncidentType({
      id: editRow.value.id,
      name: editName.value,
      department: editDepartment.value,
      active: editActive.value,
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

async function toggleActive(row: AdminIncidentType) {
  error.value = null
  try {
    await updateIncidentType({
      id: row.id,
      name: row.name,
      department: row.department,
      active: !row.active,
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
        Nieuw incidenttype
      </h2>
      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="onAdd">
        <div class="sm:col-span-2">
          <label class="ic-label" for="type-name">Naam</label>
          <InputText
            id="type-name"
            v-model="name"
            class="ic-field"
            placeholder="bijv. Brand/ Rook"
            required
          />
        </div>
        <div>
          <label class="ic-label" for="type-department">Afdeling</label>
          <Select
            id="type-department"
            v-model="department"
            :options="departmentOptions"
            option-label="label"
            option-value="value"
            class="ic-field w-full"
          />
        </div>
        <div class="flex items-end pb-1">
          <div class="flex items-center gap-2">
            <Checkbox
              v-model="active"
              input-id="type-active"
              binary
            />
            <label for="type-active" class="text-sm text-slate-700">
              Actief (zichtbaar in formulieren)
            </label>
          </div>
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
            label="Incidenttype toevoegen"
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
              {{ row.department }}
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
          Nog geen incidenttypes. Voeg hierboven een type toe.
        </li>
      </ul>
    </section>
  </div>

  <Dialog
    v-model:visible="editVisible"
    modal
    header="Incidenttype bewerken"
    class="w-full max-w-md"
    :dismissable-mask="true"
  >
    <div class="space-y-3">
      <div>
        <label class="ic-label" for="edit-type-name">Naam</label>
        <InputText
          id="edit-type-name"
          v-model="editName"
          class="ic-field"
        />
      </div>
      <div>
        <label class="ic-label" for="edit-type-department">Afdeling</label>
        <Select
          id="edit-type-department"
          v-model="editDepartment"
          :options="departmentOptions"
          option-label="label"
          option-value="value"
          class="ic-field w-full"
        />
      </div>
      <div class="flex items-center gap-2">
        <Checkbox
          v-model="editActive"
          input-id="edit-type-active"
          binary
        />
        <label for="edit-type-active" class="text-sm text-slate-700">
          Actief (zichtbaar in formulieren)
        </label>
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
