<script setup lang="ts">
import type { Incident } from '~/types/models'

const visible = defineModel<boolean>({ default: false })

const props = defineProps<{
  messageId: string | null
}>()

const emit = defineEmits<{
  linked: [incidentId: string]
}>()

const { $api } = useNuxtApp()
const query = ref('')
const incidents = ref<Incident[]>([])
const loading = ref(false)
const linking = ref(false)
const error = ref<string | null>(null)
const selectedId = ref<string | null>(null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const open = incidents.value.filter(i => i.isOpen || i.status !== 'Afgesloten')
  if (!q) return open.slice(0, 30)
  return open
    .filter(i =>
      i.incidentId.toLowerCase().includes(q)
      || i.description.toLowerCase().includes(q)
      || i.locationName.toLowerCase().includes(q),
    )
    .slice(0, 30)
})

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await $api.incidents.list()
    incidents.value = res.data ?? []
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Incidenten laden mislukt'
  }
  finally {
    loading.value = false
  }
}

watch(visible, (open) => {
  if (open) {
    selectedId.value = null
    query.value = ''
    load().catch(() => {})
  }
})

async function confirm() {
  if (!props.messageId || !selectedId.value) return
  linking.value = true
  error.value = null
  try {
    await $api.whatsapp.linkIncident(props.messageId, selectedId.value)
    emit('linked', selectedId.value)
    visible.value = false
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Koppelen mislukt'
  }
  finally {
    linking.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Koppel aan incident"
    :style="{ width: 'min(100vw - 2rem, 28rem)' }"
    :draggable="false"
    block-scroll
  >
    <Message v-if="error" severity="error" :closable="false" class="mb-3">
      {{ error }}
    </Message>

    <InputText
      v-model="query"
      class="w-full mb-3"
      placeholder="Zoek op ID, locatie of beschrijving…"
    />

    <div v-if="loading" class="ic-wa-link__loading">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      Laden…
    </div>

    <ul v-else class="ic-wa-link__list">
      <li
        v-for="incident in filtered"
        :key="incident.incidentId"
      >
        <button
          type="button"
          class="ic-wa-link__item"
          :class="{ 'ic-wa-link__item--active': selectedId === incident.incidentId }"
          @click="selectedId = incident.incidentId"
        >
          <strong>{{ incident.incidentId }}</strong>
          <span>{{ incident.locationName }} · {{ incident.priority }}</span>
          <span class="ic-wa-link__desc">{{ incident.description }}</span>
        </button>
      </li>
      <li v-if="filtered.length === 0" class="ic-wa-link__empty">
        Geen open incidenten gevonden
      </li>
    </ul>

    <template #footer>
      <Button
        label="Annuleren"
        severity="secondary"
        text
        @click="visible = false"
      />
      <Button
        label="Koppelen"
        icon="pi pi-link"
        :disabled="!selectedId"
        :loading="linking"
        @click="confirm"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.ic-wa-link__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ic-wa-link__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  width: 100%;
  text-align: left;
  padding: 0.65rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(135 161 198 / 0.35);
  background: #fff;
  cursor: pointer;
  min-height: 44px;
}

.ic-wa-link__item--active {
  border-color: var(--ic-orange);
  background: #fef8f0;
}

.ic-wa-link__desc {
  font-size: 0.85rem;
  color: #4b5563;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ic-wa-link__loading,
.ic-wa-link__empty {
  padding: 1rem;
  text-align: center;
  color: #6b7280;
}
</style>
