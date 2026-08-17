<script setup lang="ts">
import type { Staff } from '~/types/models'
import { formatStaffName } from '~/utils/staffName'
import { isValidE164, isValidPin, normalizePhone, normalizePin } from '~/utils/phone'

useHead({ title: 'Medewerkers — Admin — IC2026 DV' })

const { listStaff, addStaff, updateStaff, removeStaff, fetchMe, staff } = useStaffAuth()

const rows = ref<Staff[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const addVisible = ref(false)
const firstName = ref('')
const lastName = ref('')
const phone = ref('')
const pin = ref('')
const makeAdmin = ref(false)
const adding = ref(false)
const addError = ref<string | null>(null)

const editVisible = ref(false)
const editRow = ref<Staff | null>(null)
const editFirst = ref('')
const editLast = ref('')
const editPhone = ref('')
const editPin = ref('')
const editIsAdmin = ref(false)
const editActive = ref(true)
const savingEdit = ref(false)
const editError = ref<string | null>(null)

const confirmVisible = ref(false)
const removeTarget = ref<Staff | null>(null)
const removing = ref(false)

function isRowActive(row: Staff): boolean {
  return row.active !== false
}

function isSelf(row: Staff): boolean {
  return staff.value?.id === row.id
}

async function load() {
  loading.value = true
  error.value = null
  try {
    await fetchMe(true)
    rows.value = await listStaff()
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

function resetAddForm() {
  firstName.value = ''
  lastName.value = ''
  phone.value = ''
  pin.value = ''
  makeAdmin.value = false
  addError.value = null
}

function openAdd() {
  resetAddForm()
  addVisible.value = true
}

async function onAdd() {
  addError.value = null
  adding.value = true
  try {
    await addStaff({
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      phone: normalizePhone(phone.value),
      pin: normalizePin(pin.value),
      isAdmin: makeAdmin.value,
    })
    addVisible.value = false
    resetAddForm()
    await load()
  }
  catch (err) {
    addError.value = err instanceof Error ? err.message : 'Toevoegen mislukt'
  }
  finally {
    adding.value = false
  }
}

function openEdit(row: Staff) {
  editRow.value = row
  editFirst.value = row.firstName
  editLast.value = row.lastName
  editPhone.value = row.phone
  editPin.value = ''
  editIsAdmin.value = Boolean(row.isAdmin)
  editActive.value = isRowActive(row)
  editError.value = null
  editVisible.value = true
}

async function saveEdit() {
  if (!editRow.value) return
  editError.value = null

  const normalizedPhone = normalizePhone(editPhone.value)
  if (!isValidE164(normalizedPhone)) {
    editError.value = 'Voer een geldig telefoonnummer in (bijv. 06… of +31…)'
    return
  }

  const trimmedPin = normalizePin(editPin.value)
  if (trimmedPin && !isValidPin(trimmedPin)) {
    editError.value = 'PIN moet 6 cijfers zijn'
    return
  }

  if (isSelf(editRow.value) && !editActive.value) {
    editError.value = 'Je kunt jezelf niet deactiveren'
    return
  }

  savingEdit.value = true
  try {
    await updateStaff({
      id: editRow.value.id,
      firstName: editFirst.value.trim(),
      lastName: editLast.value.trim(),
      phone: editPhone.value,
      pin: trimmedPin || undefined,
      isAdmin: editIsAdmin.value,
      active: editActive.value,
    })
    editVisible.value = false
    await load()
  }
  catch (err) {
    editError.value = err instanceof Error ? err.message : 'Opslaan mislukt'
  }
  finally {
    savingEdit.value = false
  }
}

async function toggleActive(row: Staff) {
  if (isSelf(row) && isRowActive(row)) {
    error.value = 'Je kunt jezelf niet deactiveren'
    return
  }
  error.value = null
  try {
    await updateStaff({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      isAdmin: Boolean(row.isAdmin),
      active: !isRowActive(row),
    })
    await load()
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Status wijzigen mislukt'
  }
}

function askRemove(row: Staff) {
  removeTarget.value = row
  confirmVisible.value = true
}

async function confirmRemove() {
  if (!removeTarget.value) return
  removing.value = true
  try {
    await removeStaff(removeTarget.value.id)
    confirmVisible.value = false
    removeTarget.value = null
    await load()
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Verwijderen mislukt'
    confirmVisible.value = false
  }
  finally {
    removing.value = false
  }
}

function roleLabel(row: Staff): string {
  return row.isAdmin ? 'Admin' : 'Medewerker'
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

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="ic-section-heading mb-0">
          Medewerkers
        </h2>
        <div class="flex items-center gap-1">
          <Button
            icon="pi pi-refresh"
            severity="secondary"
            text
            rounded
            :loading="loading"
            aria-label="Vernieuwen"
            @click="load"
          />
          <Button
            label="Toevoegen"
            icon="pi pi-plus"
            size="small"
            @click="openAdd"
          />
        </div>
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
          :class="{ 'opacity-60': !isRowActive(row) }"
        >
          <div>
            <p class="font-medium text-[var(--ic-brand-dark)]">
              {{ formatStaffName(row) }}
              <span
                v-if="row.isAdmin"
                class="ml-2 text-xs font-semibold uppercase tracking-wide text-[var(--ic-orange)]"
              >Admin</span>
              <span
                v-if="!isRowActive(row)"
                class="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >Inactief</span>
            </p>
            <p class="text-sm text-slate-600">
              {{ row.phone }}
            </p>
            <p class="text-xs text-slate-500">
              {{ roleLabel(row) }} · PIN ingesteld
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              :label="isRowActive(row) ? 'Deactiveren' : 'Activeren'"
              :icon="isRowActive(row) ? 'pi pi-eye-slash' : 'pi pi-eye'"
              size="small"
              severity="secondary"
              outlined
              :disabled="isSelf(row) && isRowActive(row)"
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
            <Button
              label="Verwijderen"
              icon="pi pi-trash"
              size="small"
              severity="danger"
              outlined
              :disabled="isSelf(row)"
              @click="askRemove(row)"
            />
          </div>
        </li>
        <li
          v-if="!rows.length"
          class="px-4 py-8 text-center text-sm text-slate-500"
        >
          Nog geen medewerkers. Klik op Toevoegen om een account aan te maken.
        </li>
      </ul>
    </section>
  </div>

  <Dialog
    v-model:visible="addVisible"
    modal
    header="Nieuwe medewerker"
    class="w-full max-w-md"
    :dismissable-mask="true"
  >
    <form
      id="add-staff-form"
      class="space-y-3"
      @submit.prevent="onAdd"
    >
      <div>
        <label class="ic-label" for="admin-first">Voornaam</label>
        <InputText
          id="admin-first"
          v-model="firstName"
          class="ic-field"
          required
        />
      </div>
      <div>
        <label class="ic-label" for="admin-last">Achternaam</label>
        <InputText
          id="admin-last"
          v-model="lastName"
          class="ic-field"
          required
        />
      </div>
      <div>
        <label class="ic-label" for="admin-phone">Telefoonnummer</label>
        <InputText
          id="admin-phone"
          v-model="phone"
          class="ic-field"
          type="tel"
          required
        />
      </div>
      <div>
        <label class="ic-label" for="admin-pin">PIN (6 cijfers)</label>
        <p class="ic-label-hint">
          Geef deze PIN door aan de medewerker — zij kunnen niet zelf een account maken.
        </p>
        <InputText
          id="admin-pin"
          v-model="pin"
          class="ic-field"
          type="password"
          inputmode="numeric"
          maxlength="6"
          pattern="\d{6}"
          required
        />
      </div>
      <div class="flex items-center gap-2">
        <Checkbox
          v-model="makeAdmin"
          input-id="admin-make-admin"
          binary
        />
        <label for="admin-make-admin" class="text-sm text-slate-700">
          Admin-rechten (mag medewerkers beheren)
        </label>
      </div>
      <Message
        v-if="addError"
        severity="error"
        :closable="false"
      >
        {{ addError }}
      </Message>
    </form>
    <template #footer>
      <Button
        label="Annuleren"
        severity="secondary"
        text
        @click="addVisible = false"
      />
      <Button
        type="submit"
        form="add-staff-form"
        label="Account aanmaken"
        icon="pi pi-plus"
        :loading="adding"
      />
    </template>
  </Dialog>

  <Dialog
    v-model:visible="editVisible"
    modal
    header="Medewerker bewerken"
    class="w-full max-w-md"
    :dismissable-mask="true"
  >
    <div class="space-y-3">
      <div>
        <label class="ic-label" for="edit-phone">Telefoonnummer</label>
        <InputText
          id="edit-phone"
          v-model="editPhone"
          class="ic-field"
          inputmode="tel"
          autocomplete="tel"
        />
      </div>
      <div>
        <label class="ic-label" for="edit-first">Voornaam</label>
        <InputText
          id="edit-first"
          v-model="editFirst"
          class="ic-field"
        />
      </div>
      <div>
        <label class="ic-label" for="edit-last">Achternaam</label>
        <InputText
          id="edit-last"
          v-model="editLast"
          class="ic-field"
        />
      </div>
      <div>
        <label class="ic-label" for="edit-pin">Nieuwe PIN (optioneel, 6 cijfers)</label>
        <p class="ic-label-hint">
          Leeg laten om de huidige PIN te behouden.
        </p>
        <InputText
          id="edit-pin"
          v-model="editPin"
          class="ic-field"
          type="password"
          inputmode="numeric"
          maxlength="6"
          pattern="\d{6}"
        />
      </div>
      <div class="flex items-center gap-2">
        <Checkbox
          v-model="editIsAdmin"
          input-id="edit-is-admin"
          binary
        />
        <label for="edit-is-admin" class="text-sm text-slate-700">
          Admin-rechten
        </label>
      </div>
      <div class="flex items-center gap-2">
        <Checkbox
          v-model="editActive"
          input-id="edit-is-active"
          binary
          :disabled="Boolean(editRow && isSelf(editRow))"
        />
        <label for="edit-is-active" class="text-sm text-slate-700">
          Actief (mag inloggen)
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

  <Dialog
    v-model:visible="confirmVisible"
    modal
    header="Verwijderen?"
    class="w-full max-w-sm"
    :dismissable-mask="true"
  >
    <p class="text-sm text-slate-700">
      Verwijder
      <strong>{{ removeTarget ? formatStaffName(removeTarget) : '' }}</strong>
      en hun login?
    </p>
    <template #footer>
      <Button
        label="Annuleren"
        severity="secondary"
        text
        @click="confirmVisible = false"
      />
      <Button
        label="Verwijderen"
        severity="danger"
        icon="pi pi-trash"
        :loading="removing"
        @click="confirmRemove"
      />
    </template>
  </Dialog>
</template>
