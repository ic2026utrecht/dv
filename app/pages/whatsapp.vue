<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

useHead({
  title: 'WhatsApp — IC2026 Dienstverlening',
})

const { $api } = useNuxtApp()
const { isAdmin, fetchMe } = useStaffAuth()
const toast = useState<string | null>('wa-toast', () => null)

const {
  connection,
  loading,
  error,
  selectedGroupJid,
  selectedMessageId,
  selectedMessage,
  statusFilter,
  periodFilter,
  activeOnlyGroups,
  unreadTotal,
  monitoredGroups,
  filteredGroups,
  filteredMessages,
  loadAll,
  markMessage,
  sendReply,
  setMonitored,
  startRealtime,
  stopRealtime,
  refreshMessages,
  fetchConnection,
  fetchGroups,
} = useWhatsappFeed()

const setupOpen = ref(false)
const groupSearch = ref('')
const mobileGroupsOpen = ref(false)
const replyOpen = ref(false)
const replyText = ref('')
const replySubmitting = ref(false)
const linkOpen = ref(false)
const linkMessageId = ref<string | null>(null)
const createOpen = ref(false)
const createMessage = computed(() => selectedMessage.value)
const actionError = ref<string | null>(null)

onMounted(async () => {
  await fetchMe().catch(() => {})
  await loadAll().catch(() => {})
  startRealtime()
  maybeRequestNotifications()
})

onBeforeUnmount(() => {
  stopRealtime()
  window.removeEventListener('keydown', onKeydown)
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

function maybeRequestNotifications() {
  if (!import.meta.client || !('Notification' in window)) return
  if (Notification.permission === 'default') {
    // Soft prompt once — user can dismiss
  }
}

watch(unreadTotal, (count, prev) => {
  if (!import.meta.client || !('Notification' in window)) return
  if (document.visibilityState === 'visible') return
  if (count > (prev ?? 0) && Notification.permission === 'granted') {
    // eslint-disable-next-line no-new
    new Notification('Nieuw WhatsApp-bericht', {
      body: `${count} openstaande berichten in de control room`,
      tag: 'ic2026-whatsapp',
    })
  }
})

function showToast(message: string) {
  toast.value = message
  window.setTimeout(() => {
    if (toast.value === message) toast.value = null
  }, 2800)
}

function openSetup() {
  if (!isAdmin.value) return
  setupOpen.value = true
}

async function onToggleMonitored(groupJid: string, isMonitored: boolean) {
  try {
    await setMonitored(groupJid, isMonitored)
    showToast(isMonitored ? 'Kanaal gemonitord' : 'Monitoring uit')
  }
  catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Opslaan mislukt'
  }
}

async function onMonitorActiveToday() {
  try {
    const count = await $api.whatsapp.monitorActiveToday()
    await fetchGroups()
    showToast(`${count} kanalen aangezet`)
  }
  catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Actie mislukt'
  }
}

async function onHandled(id: string) {
  try {
    await markMessage(id, 'handled')
    showToast('Bericht afgehandeld')
    if (selectedMessageId.value === id) replyOpen.value = false
  }
  catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Actie mislukt'
  }
}

async function onFlag(id: string) {
  try {
    await markMessage(id, 'flagged')
    showToast('Bericht gemarkeerd')
  }
  catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Actie mislukt'
  }
}

function onReply(id: string) {
  selectedMessageId.value = id
  replyOpen.value = true
  replyText.value = ''
}

function onLink(id: string) {
  selectedMessageId.value = id
  linkMessageId.value = id
  linkOpen.value = true
}

function onCreate(id: string) {
  selectedMessageId.value = id
  createOpen.value = true
}

async function submitReply() {
  if (!selectedMessageId.value || !replyText.value.trim()) return
  replySubmitting.value = true
  try {
    await sendReply(selectedMessageId.value, replyText.value.trim())
    replyText.value = ''
    replyOpen.value = false
    showToast('Antwoord verzonden')
  }
  catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Versturen mislukt'
  }
  finally {
    replySubmitting.value = false
  }
}

function onLinked(incidentId: string) {
  showToast(`Gekoppeld aan ${incidentId}`)
  refreshMessages().catch(() => {})
}

function onCreated(incidentId: string) {
  showToast(`Incident ${incidentId} aangemaakt`)
  refreshMessages().catch(() => {})
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (!selectedMessageId.value) return

  const key = event.key.toLowerCase()
  if (key === 'h') {
    event.preventDefault()
    onHandled(selectedMessageId.value)
  }
  else if (key === 'f') {
    event.preventDefault()
    onFlag(selectedMessageId.value)
  }
  else if (key === 'r') {
    event.preventDefault()
    onReply(selectedMessageId.value)
  }
  else if (key === 'i') {
    event.preventDefault()
    onLink(selectedMessageId.value)
  }
  else if (key === 'n') {
    event.preventDefault()
    onCreate(selectedMessageId.value)
  }
}

async function onSetupRefreshed() {
  await Promise.all([fetchConnection(), fetchGroups()])
}
</script>

<template>
  <div class="ic-page ic-page--whatsapp">
    <div class="ic-shell ic-shell--whatsapp">
      <PageHeader
        title="WhatsApp"
        subtitle="Live groepsfeed voor de control room"
      />

      <WhatsappConnectionStatus
        :connection="connection"
        :is-admin="isAdmin"
        @open-setup="openSetup"
        @reconnect="openSetup"
      />

      <Message
        v-if="toast"
        severity="success"
        :closable="false"
        class="ic-wa-toast"
      >
        {{ toast }}
      </Message>

      <Message
        v-if="error || actionError"
        severity="error"
        class="ic-wa-page-error"
        @close="actionError = null"
      >
        {{ error || actionError }}
      </Message>

      <div class="ic-wa-layout">
        <div class="ic-wa-layout__sidebar-wrap">
          <Button
            class="ic-wa-mobile-groups"
            :label="selectedGroupJid ? 'Kanaal wisselen' : 'Kanalen'"
            icon="pi pi-list"
            severity="secondary"
            outlined
            @click="mobileGroupsOpen = true"
          />

          <WhatsappGroupSidebar
            class="ic-wa-layout__sidebar"
            :groups="filteredGroups"
            :selected-group-jid="selectedGroupJid"
            :is-admin="isAdmin"
            :active-only="activeOnlyGroups"
            :search="groupSearch"
            @update:selected-group-jid="selectedGroupJid = $event; mobileGroupsOpen = false"
            @update:active-only="activeOnlyGroups = $event"
            @update:search="groupSearch = $event"
            @toggle-monitored="onToggleMonitored"
            @monitor-active-today="onMonitorActiveToday"
            @open-setup="openSetup"
          />
        </div>

        <div class="ic-wa-layout__main">
          <WhatsappMessageFeed
            :messages="filteredMessages"
            :selected-message-id="selectedMessageId"
            :loading="loading"
            :status-filter="statusFilter"
            :period-filter="periodFilter"
            :connection-status="connection?.status ?? null"
            :has-monitored-groups="monitoredGroups.length > 0"
            :is-admin="isAdmin"
            @update:status-filter="statusFilter = $event"
            @update:period-filter="periodFilter = $event"
            @update:selected-message-id="selectedMessageId = $event"
            @handled="onHandled"
            @flag="onFlag"
            @reply="onReply"
            @link="onLink"
            @create="onCreate"
            @open-setup="openSetup"
          />

          <WhatsappReplyComposer
            v-if="replyOpen && selectedMessage"
            v-model="replyText"
            :recipient-label="selectedMessage.groupName || 'groep'"
            :submitting="replySubmitting"
            @send="submitReply"
            @cancel="replyOpen = false"
          />
        </div>
      </div>
    </div>

    <WhatsappSetupPanel
      v-if="isAdmin"
      v-model="setupOpen"
      :connection="connection"
      @refreshed="onSetupRefreshed"
    />

    <WhatsappLinkIncidentDialog
      v-model="linkOpen"
      :message-id="linkMessageId"
      @linked="onLinked"
    />

    <WhatsappCreateIncidentDrawer
      v-model="createOpen"
      :message="createMessage"
      @created="onCreated"
    />

    <Drawer
      v-model:visible="mobileGroupsOpen"
      position="left"
      header="Kanalen"
      class="ic-wa-mobile-drawer"
      :style="{ width: 'min(100vw, 20rem)' }"
    >
      <WhatsappGroupSidebar
        :groups="filteredGroups"
        :selected-group-jid="selectedGroupJid"
        :is-admin="isAdmin"
        :active-only="activeOnlyGroups"
        :search="groupSearch"
        @update:selected-group-jid="selectedGroupJid = $event; mobileGroupsOpen = false"
        @update:active-only="activeOnlyGroups = $event"
        @update:search="groupSearch = $event"
        @toggle-monitored="onToggleMonitored"
        @monitor-active-today="onMonitorActiveToday"
        @open-setup="openSetup"
      />
    </Drawer>
  </div>
</template>
