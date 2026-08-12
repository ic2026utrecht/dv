<script setup lang="ts">
import type { WhatsappConnectionInfo } from '~/types/models'

const props = defineProps<{
  connection: WhatsappConnectionInfo | null
  isAdmin: boolean
}>()

const emit = defineEmits<{
  openSetup: []
  reconnect: []
}>()

const statusLabel = computed(() => {
  switch (props.connection?.status) {
    case 'connected':
      return props.connection.phone
        ? `Verbonden (${props.connection.phone})`
        : 'Verbonden'
    case 'qr':
      return 'QR scannen'
    case 'connecting':
      return 'Verbinden…'
    default:
      return 'Niet verbonden'
  }
})

const statusClass = computed(() => {
  switch (props.connection?.status) {
    case 'connected':
      return 'ic-wa-status--ok'
    case 'qr':
    case 'connecting':
      return 'ic-wa-status--warn'
    default:
      return 'ic-wa-status--err'
  }
})

const showReconnect = computed(() =>
  props.connection?.status === 'disconnected' || props.connection?.status === 'qr',
)

function onStatusClick() {
  if (props.isAdmin) {
    emit('openSetup')
  }
}
</script>

<template>
  <div class="ic-wa-status-bar">
    <button
      type="button"
      class="ic-wa-status-pill"
      :class="[statusClass, { 'ic-wa-status-pill--static': !isAdmin }]"
      :aria-label="`WhatsApp status: ${statusLabel}`"
      :disabled="!isAdmin"
      @click="onStatusClick"
    >
      <span class="ic-wa-status-pill__dot" aria-hidden="true" />
      <span>{{ statusLabel }}</span>
      <i
        v-if="isAdmin"
        class="pi pi-cog"
        aria-hidden="true"
      />
    </button>

    <div
      v-if="showReconnect && isAdmin"
      class="ic-wa-reconnect"
      role="status"
    >
      <span>WhatsApp-sessie niet actief.</span>
      <Button
        label="Opnieuw verbinden"
        size="small"
        icon="pi pi-qrcode"
        @click="emit('reconnect')"
      />
    </div>

    <p
      v-else-if="showReconnect && !isAdmin"
      class="ic-wa-reconnect-hint"
      role="status"
    >
      Alleen admins kunnen WhatsApp koppelen. Vraag een admin om te verbinden.
    </p>
  </div>
</template>
