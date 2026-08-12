<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

useHead({ title: 'Profiel — IC2026 DV' })

const {
  staff,
  fetchMe,
  updateStaff,
  changePin,
  logout,
  displayName,
  isAdmin,
} = useStaffAuth()

const firstName = ref('')
const lastName = ref('')
const currentPin = ref('')
const newPin = ref('')
const confirmPin = ref('')

const savingProfile = ref(false)
const savingPin = ref(false)
const profileMessage = ref<string | null>(null)
const profileError = ref<string | null>(null)
const pinMessage = ref<string | null>(null)
const pinError = ref<string | null>(null)

onMounted(async () => {
  await fetchMe(true)
  if (staff.value) {
    firstName.value = staff.value.firstName
    lastName.value = staff.value.lastName
  }
})

async function saveProfile() {
  profileError.value = null
  profileMessage.value = null
  if (!staff.value) return
  savingProfile.value = true
  try {
    await updateStaff({
      id: staff.value.id,
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
    })
    profileMessage.value = 'Profiel opgeslagen'
  }
  catch (err) {
    profileError.value = err instanceof Error ? err.message : 'Opslaan mislukt'
  }
  finally {
    savingProfile.value = false
  }
}

async function savePin() {
  pinError.value = null
  pinMessage.value = null
  if (newPin.value !== confirmPin.value) {
    pinError.value = 'Nieuwe PIN komt niet overeen'
    return
  }
  savingPin.value = true
  try {
    await changePin(currentPin.value, newPin.value)
    currentPin.value = ''
    newPin.value = ''
    confirmPin.value = ''
    pinMessage.value = 'PIN gewijzigd'
  }
  catch (err) {
    pinError.value = err instanceof Error ? err.message : 'PIN wijzigen mislukt'
  }
  finally {
    savingPin.value = false
  }
}

async function onLogout() {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="ic-page">
    <div class="ic-shell">
      <LayoutPageHeader
        title="Profiel"
        :subtitle="displayName || 'Je account'"
      />

      <div class="space-y-6 p-5 sm:p-6">
        <section class="ic-card space-y-4">
          <h2 class="ic-section-heading mb-0">
            Gegevens
          </h2>

          <div>
            <label class="ic-label" for="profile-phone">Telefoonnummer</label>
            <InputText
              id="profile-phone"
              :model-value="staff?.phone ?? ''"
              class="ic-field"
              disabled
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="ic-label" for="profile-first">Voornaam</label>
              <InputText
                id="profile-first"
                v-model="firstName"
                class="ic-field"
                required
              />
            </div>
            <div>
              <label class="ic-label" for="profile-last">Achternaam</label>
              <InputText
                id="profile-last"
                v-model="lastName"
                class="ic-field"
                required
              />
            </div>
          </div>

          <Message
            v-if="profileError"
            severity="error"
            :closable="false"
          >
            {{ profileError }}
          </Message>
          <Message
            v-if="profileMessage"
            severity="success"
            :closable="false"
          >
            {{ profileMessage }}
          </Message>

          <Button
            label="Opslaan"
            icon="pi pi-save"
            :loading="savingProfile"
            @click="saveProfile"
          />
        </section>

        <section class="ic-card space-y-4">
          <h2 class="ic-section-heading mb-0">
            PIN wijzigen
          </h2>

          <div>
            <label class="ic-label" for="pin-current">Huidige PIN</label>
            <InputText
              id="pin-current"
              v-model="currentPin"
              class="ic-field"
              type="password"
              inputmode="numeric"
              maxlength="6"
            />
          </div>
          <div>
            <label class="ic-label" for="pin-new">Nieuwe PIN (4–6 cijfers)</label>
            <InputText
              id="pin-new"
              v-model="newPin"
              class="ic-field"
              type="password"
              inputmode="numeric"
              maxlength="6"
            />
          </div>
          <div>
            <label class="ic-label" for="pin-confirm">Bevestig nieuwe PIN</label>
            <InputText
              id="pin-confirm"
              v-model="confirmPin"
              class="ic-field"
              type="password"
              inputmode="numeric"
              maxlength="6"
            />
          </div>

          <Message
            v-if="pinError"
            severity="error"
            :closable="false"
          >
            {{ pinError }}
          </Message>
          <Message
            v-if="pinMessage"
            severity="success"
            :closable="false"
          >
            {{ pinMessage }}
          </Message>

          <Button
            label="PIN wijzigen"
            icon="pi pi-lock"
            severity="secondary"
            :loading="savingPin"
            @click="savePin"
          />
        </section>

        <div class="flex flex-wrap gap-2">
          <NuxtLink to="/sitrep">
            <Button
              label="Sitrep"
              icon="pi pi-chart-bar"
              severity="secondary"
              outlined
            />
          </NuxtLink>
          <NuxtLink v-if="isAdmin" to="/admin">
            <Button
              label="Beheer medewerkers"
              icon="pi pi-users"
              severity="secondary"
              outlined
            />
          </NuxtLink>
          <Button
            label="Uitloggen"
            icon="pi pi-sign-out"
            severity="danger"
            outlined
            @click="onLogout"
          />
        </div>
      </div>
    </div>
  </div>
</template>
