<script setup lang="ts">
useHead({ title: 'Inloggen — IC2026 DV' })

const route = useRoute()
const {
  checkPhone,
  login,
  isLoggedIn,
} = useStaffAuth()

const step = ref<'phone' | 'pin'>('phone')
const phone = ref('')
const pin = ref('')
const greetName = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

const redirectTo = computed(() => {
  const value = route.query.redirect
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
    return value
  }
  return '/sitrep'
})

onMounted(() => {
  if (isLoggedIn.value) {
    navigateTo(redirectTo.value)
  }
})

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) navigateTo(redirectTo.value)
})

async function onCheckPhone() {
  error.value = null
  submitting.value = true
  try {
    const result = await checkPhone(phone.value)
    phone.value = result.phone
    greetName.value = `${result.firstName} ${result.lastName}`.trim()
    step.value = 'pin'
    pin.value = ''
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Controleren mislukt'
  }
  finally {
    submitting.value = false
  }
}

async function onSubmitPin() {
  error.value = null
  submitting.value = true
  try {
    await login(phone.value, pin.value)
    await navigateTo(redirectTo.value)
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Inloggen mislukt'
  }
  finally {
    submitting.value = false
  }
}

function backToPhone() {
  step.value = 'phone'
  pin.value = ''
  error.value = null
}
</script>

<template>
  <div class="ic-page">
    <div class="ic-shell">
      <PageHeader
        title="Inloggen"
        subtitle="Alleen voor Sitrep-medewerkers (telefoon + PIN)"
      />

      <div class="space-y-5 p-5 sm:p-6">
        <p
          v-if="step === 'pin' && greetName"
          class="text-sm text-slate-600"
        >
          Welkom, <strong>{{ greetName }}</strong>
        </p>

        <form
          v-if="step === 'phone'"
          class="space-y-4"
          @submit.prevent="onCheckPhone"
        >
          <div>
            <label class="ic-label" for="login-phone">
              Telefoonnummer <span class="ic-required">*</span>
            </label>
            <p class="ic-label-hint">
              Bijv. 06 12345678 of +31 6 12345678
            </p>
            <InputText
              id="login-phone"
              v-model="phone"
              class="ic-field"
              type="tel"
              autocomplete="tel"
              inputmode="tel"
              required
            />
          </div>

          <Message
            v-if="error"
            severity="error"
            :closable="false"
          >
            {{ error }}
          </Message>

          <Button
            type="submit"
            label="Verder"
            icon="pi pi-arrow-right"
            icon-pos="right"
            class="w-full"
            size="large"
            :loading="submitting"
          />
        </form>

        <form
          v-else
          class="space-y-4"
          @submit.prevent="onSubmitPin"
        >
          <div>
            <label class="ic-label" for="login-pin">
              PIN <span class="ic-required">*</span>
            </label>
            <p class="ic-label-hint">
              PIN is door een admin ingesteld (4–6 cijfers).
            </p>
            <InputText
              id="login-pin"
              v-model="pin"
              class="ic-field"
              type="password"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              pattern="\d{4,6}"
              required
            />
          </div>

          <Message
            v-if="error"
            severity="error"
            :closable="false"
          >
            {{ error }}
          </Message>

          <div class="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              label="Terug"
              severity="secondary"
              outlined
              class="w-full sm:w-auto"
              :disabled="submitting"
              @click="backToPhone"
            />
            <Button
              type="submit"
              label="Inloggen"
              icon="pi pi-sign-in"
              class="w-full flex-1"
              size="large"
              :loading="submitting"
            />
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
