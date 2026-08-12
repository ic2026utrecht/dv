<script setup lang="ts">
import type { WhatsappConnectionInfo } from '~/types/models'

const visible = defineModel<boolean>({ default: false })

const props = defineProps<{
  connection: WhatsappConnectionInfo | null
}>()

const emit = defineEmits<{
  refreshed: []
}>()

const { $api } = useNuxtApp()
const toast = useState<string | null>('wa-toast', () => null)

const qrInfo = ref<WhatsappConnectionInfo | null>(null)
const loadingQr = ref(false)
const syncing = ref(false)
const disconnecting = ref(false)
const confirmDisconnect = ref(false)
const error = ref<string | null>(null)
const countdown = ref(20)
let pollTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null

const step = computed(() => {
  const status = qrInfo.value?.status ?? props.connection?.status
  if (status === 'connected') return 3
  if (status === 'qr' || status === 'connecting') return 1
  return 0
})

const qrSrc = computed(() => {
  const b64 = qrInfo.value?.qrBase64
  if (!b64) return ''
  return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`
})

async function refreshQr() {
  loadingQr.value = true
  error.value = null
  try {
    qrInfo.value = await $api.whatsapp.getQr()
    countdown.value = 20
    emit('refreshed')
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'QR ophalen mislukt'
  }
  finally {
    loadingQr.value = false
  }
}

async function syncGroups() {
  syncing.value = true
  error.value = null
  try {
    const count = await $api.whatsapp.syncGroups()
    toast.value = `${count} groepen gesynchroniseerd`
    emit('refreshed')
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Sync mislukt'
  }
  finally {
    syncing.value = false
  }
}

async function doDisconnect() {
  disconnecting.value = true
  error.value = null
  try {
    await $api.whatsapp.disconnect()
    confirmDisconnect.value = false
    qrInfo.value = null
    toast.value = 'Verbinding verbroken'
    emit('refreshed')
    await refreshQr()
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Verbreken mislukt'
  }
  finally {
    disconnecting.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (visible.value) refreshQr().catch(() => {})
  }, 20_000)
  countdownTimer = setInterval(() => {
    if (countdown.value > 0) countdown.value -= 1
  }, 1000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

watch(visible, (open) => {
  if (open) {
    refreshQr().catch(() => {})
    startPolling()
  }
  else {
    stopPolling()
  }
})

onBeforeUnmount(stopPolling)
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="WhatsApp-instellingen"
    class="ic-wa-setup"
    :style="{ width: 'min(100vw - 2rem, 28rem)' }"
    :draggable="false"
    block-scroll
  >
    <ol class="ic-wa-setup__steps" aria-label="Installatiestappen">
      <li :class="{ 'ic-wa-setup__step--active': step === 0, 'ic-wa-setup__step--done': step > 0 }">
        Verbinden
      </li>
      <li :class="{ 'ic-wa-setup__step--active': step === 1, 'ic-wa-setup__step--done': step > 1 }">
        QR scannen
      </li>
      <li :class="{ 'ic-wa-setup__step--active': step >= 2, 'ic-wa-setup__step--done': step >= 3 }">
        Groepen
      </li>
      <li :class="{ 'ic-wa-setup__step--done': step >= 3 }">
        Klaar
      </li>
    </ol>

    <Message v-if="error" severity="error" :closable="false" class="mb-3">
      {{ error }}
    </Message>

    <div
      v-if="(qrInfo?.status ?? connection?.status) === 'connected'"
      class="ic-wa-setup__connected"
    >
      <i class="pi pi-check-circle" aria-hidden="true" />
      <div>
        <p class="ic-wa-setup__title">
          Verbonden
        </p>
        <p class="ic-wa-setup__meta">
          {{ qrInfo?.phone || connection?.phone || 'Telefoon gekoppeld' }}
        </p>
      </div>
    </div>

    <div v-else class="ic-wa-setup__qr">
      <p class="ic-wa-setup__hint">
        Open WhatsApp → <strong>Gekoppelde apparaten</strong> → <strong>Apparaat koppelen</strong>
        en scan deze code.
      </p>
      <div class="ic-wa-setup__qr-frame">
        <img
          v-if="qrSrc"
          :src="qrSrc"
          alt="WhatsApp QR-code"
          width="220"
          height="220"
        >
        <div v-else class="ic-wa-setup__qr-empty">
          <i
            class="pi"
            :class="loadingQr ? 'pi-spin pi-spinner' : 'pi-qrcode'"
            aria-hidden="true"
          />
          <span>{{ loadingQr ? 'QR laden…' : 'Geen QR beschikbaar' }}</span>
        </div>
      </div>
      <p class="ic-wa-setup__countdown">
        Ververs over {{ countdown }}s
      </p>
      <Button
        label="QR vernieuwen"
        icon="pi pi-refresh"
        severity="secondary"
        size="small"
        :loading="loadingQr"
        @click="refreshQr"
      />
    </div>

    <div class="ic-wa-setup__actions">
      <Button
        label="Groepen syncen"
        icon="pi pi-sync"
        :loading="syncing"
        :disabled="(qrInfo?.status ?? connection?.status) !== 'connected'"
        @click="syncGroups"
      />
      <Button
        v-if="(qrInfo?.status ?? connection?.status) === 'connected'"
        label="Verbinding verbreken"
        icon="pi pi-sign-out"
        severity="danger"
        outlined
        @click="confirmDisconnect = true"
      />
    </div>

    <Dialog
      v-model:visible="confirmDisconnect"
      modal
      header="Telefoon wisselen?"
      :style="{ width: 'min(100vw - 2rem, 24rem)' }"
      :draggable="false"
    >
      <p>
        Historische berichten blijven bewaard. Na het wisselen moet je groepen opnieuw syncen
        en monitor-kanalen opnieuw instellen.
      </p>
      <template #footer>
        <Button
          label="Annuleren"
          severity="secondary"
          text
          @click="confirmDisconnect = false"
        />
        <Button
          label="Verbreken"
          severity="danger"
          :loading="disconnecting"
          @click="doDisconnect"
        />
      </template>
    </Dialog>
  </Dialog>
</template>
