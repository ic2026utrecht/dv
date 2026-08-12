<script setup lang="ts">
import type { Staff } from '~/types/models'
import { formatStaffName } from '~/utils/staffName'
import { isValidE164, normalizePhone } from '~/utils/phone'

definePageMeta({ middleware: ['auth', 'admin'] })

useHead({ title: 'Medewerkers — IC2026 DV' })

const { listStaff, addStaff, updateStaff, removeStaff, fetchMe } = useStaffAuth()

const rows = ref<Staff[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

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
const savingEdit = ref(false)
const editError = ref<string | null>(null)

const confirmVisible = ref(false)
const removeTarget = ref<Staff | null>(null)
const removing = ref(false)

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

async function onAdd() {
  addError.value = null
  adding.value = true
  try {
    await addStaff({
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      phone: normalizePhone(phone.value),
      pin: pin.value.trim(),
      isAdmin: makeAdmin.value,
    })
    firstName.value = ''
    lastName.value = ''
    phone.value = ''
    pin.value = ''
    makeAdmin.value = false
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

  savingEdit.value = true
  try {
    await updateStaff({
      id: editRow.value.id,
      firstName: editFirst.value.trim(),
      lastName: editLast.value.trim(),
      phone: editPhone.value,
      pin: editPin.value.trim() || undefined,
      isAdmin: editIsAdmin.value,
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
  <div class="ic-page" style="max-width: 48rem;">
    <div class="ic-shell">
      <PageHeader
        title="Medewerkers"
        subtitle="Accounts aanmaken met telefoon + PIN (alleen admins)"
      />

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
            Nieuwe medewerker
          </h2>
          <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="onAdd">
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
            <div class="sm:col-span-2">
              <label class="ic-label" for="admin-phone">Telefoonnummer</label>
              <InputText
                id="admin-phone"
                v-model="phone"
                class="ic-field"
                type="tel"
                required
              />
            </div>
            <div class="sm:col-span-2">
              <label class="ic-label" for="admin-pin">PIN (4–6 cijfers)</label>
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
                pattern="\d{4,6}"
                required
              />
            </div>
            <div class="sm:col-span-2 flex items-center gap-2">
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
              class="sm:col-span-2"
              severity="error"
              :closable="false"
            >
              {{ addError }}
            </Message>
            <div class="sm:col-span-2">
              <Button
                type="submit"
                label="Account aanmaken"
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
            >
              <div>
                <p class="font-medium text-[var(--ic-brand-dark)]">
                  {{ formatStaffName(row) }}
                  <span
                    v-if="row.isAdmin"
                    class="ml-2 text-xs font-semibold uppercase tracking-wide text-[var(--ic-orange)]"
                  >Admin</span>
                </p>
                <p class="text-sm text-slate-600">
                  {{ row.phone }}
                </p>
                <p class="text-xs text-slate-500">
                  {{ roleLabel(row) }} · PIN ingesteld
                </p>
              </div>
              <div class="flex gap-2">
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
                  @click="askRemove(row)"
                />
              </div>
            </li>
            <li
              v-if="!rows.length"
              class="px-4 py-8 text-center text-sm text-slate-500"
            >
              Nog geen medewerkers. Maak hierboven een account aan.
            </li>
          </ul>
        </section>
      </div>
    </div>

    <Dialog
      v-model:visible="editVisible"
      modal
      header="Medewerker bewerken"
      class="w-full max-w-md"
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
          <label class="ic-label" for="edit-pin">Nieuwe PIN (optioneel)</label>
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
  </div>
</template>
