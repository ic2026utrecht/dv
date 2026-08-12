<script setup lang="ts">
import type { Incident, IncidentStatus, IncidentUpdateEntry } from '~/types/models'

const props = defineProps<{
  incident: Incident | null
  refreshKey?: number
}>()

const emit = defineEmits<{
  noteAdded: []
}>()

const { $api } = useNuxtApp()
const { updateIncident } = useSitrep()
const { displayName, fetchMe } = useStaffAuth()

const entries = ref<IncidentUpdateEntry[]>([])
const loading = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)
const note = ref('')
const author = ref('')
const feedRef = ref<HTMLElement | null>(null)

type FeedItem
  = | { kind: 'date', key: string, label: string }
    | { kind: 'status', key: string, entry: IncidentUpdateEntry }
    | { kind: 'message', key: string, entry: IncidentUpdateEntry, text: string }

function statusBadgeClass(status: IncidentStatus): string {
  switch (status) {
    case 'Open':
      return 'ic-update-feed__status--open'
    case 'In behandeling':
      return 'ic-update-feed__status--progress'
    case 'Afgesloten':
      return 'ic-update-feed__status--closed'
    default:
      return 'ic-update-feed__status--default'
  }
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDateSeparator(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)

  if (diffDays === 0) {
    return 'Vandaag'
  }
  if (diffDays === 1) {
    return 'Gisteren'
  }

  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function messageText(entry: IncidentUpdateEntry, index: number): string | null {
  if (entry.notes.trim()) {
    return entry.notes.trim()
  }
  if (index === 0) {
    return 'Incident geregistreerd'
  }
  if (entry.previousStatus && entry.status !== entry.previousStatus) {
    return null
  }
  if (entry.hasPayloadChanges) {
    return 'Gegevens bijgewerkt'
  }
  return null
}

function statusChanged(entry: IncidentUpdateEntry): boolean {
  return Boolean(entry.previousStatus && entry.status !== entry.previousStatus)
}

const feedItems = computed<FeedItem[]>(() => {
  const items: FeedItem[] = []
  let lastDateKey = ''

  entries.value.forEach((entry, index) => {
    const dateKey = entry.createdAt.slice(0, 10)
    if (dateKey !== lastDateKey) {
      items.push({
        kind: 'date',
        key: `date-${dateKey}`,
        label: formatDateSeparator(entry.createdAt),
      })
      lastDateKey = dateKey
    }

    if (statusChanged(entry)) {
      items.push({
        kind: 'status',
        key: `status-${entry.id}`,
        entry,
      })
    }

    const text = messageText(entry, index)
    if (text) {
      items.push({
        kind: 'message',
        key: `message-${entry.id}`,
        entry,
        text,
      })
    }
  })

  return items
})

async function loadHistory() {
  if (!props.incident) {
    entries.value = []
    error.value = null
    return
  }

  loading.value = true
  error.value = null

  try {
    const response = await $api.incidents.getUpdateHistory(props.incident.incidentId)
    entries.value = response.data ?? []
    await nextTick()
    scrollToBottom()
  }
  catch (err: unknown) {
    entries.value = []
    error.value = err instanceof Error ? err.message : 'Updates laden mislukt'
  }
  finally {
    loading.value = false
  }
}

function scrollToBottom() {
  if (!feedRef.value) {
    return
  }
  feedRef.value.scrollTop = feedRef.value.scrollHeight
}

async function submitNote() {
  if (!props.incident || submitting.value) {
    return
  }

  const trimmedNote = note.value.trim()
  if (!trimmedNote) {
    return
  }

  submitting.value = true
  error.value = null

  try {
    const trimmedAuthor = author.value.trim()
    await updateIncident({
      incidentId: props.incident.incidentId,
      status: props.incident.status,
      updateNotes: trimmedNote,
      updatedBy: trimmedAuthor || undefined,
    })
    note.value = ''
    emit('noteAdded')
    await loadHistory()
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Notitie opslaan mislukt'
  }
  finally {
    submitting.value = false
  }
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submitNote()
  }
}

watch(
  () => [props.incident?.incidentId, props.refreshKey] as const,
  async () => {
    await fetchMe().catch(() => {})
    author.value = displayName.value || props.incident?.actionOwner || ''
    loadHistory()
  },
  { immediate: true },
)

watch(displayName, (name) => {
  if (name && !author.value.trim()) {
    author.value = name
  }
})
</script>

<template>
  <section class="ic-update-feed" aria-label="Incidentupdates">
    <header class="ic-update-feed__header">
      <h3 class="ic-update-feed__title">
        Updates
      </h3>
      <span v-if="incident" class="ic-update-feed__count">
        {{ entries.length }}
      </span>
    </header>

    <div ref="feedRef" class="ic-update-feed__messages">
      <div v-if="loading" class="ic-update-feed__state">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        <span>Updates laden…</span>
      </div>

      <Message v-else-if="error && entries.length === 0" severity="warn" :closable="false">
        {{ error }}
      </Message>

      <p v-else-if="!incident" class="ic-update-feed__state">
        Geen incident geselecteerd
      </p>

      <p v-else-if="feedItems.length === 0" class="ic-update-feed__state">
        Nog geen updates. Voeg hieronder een notitie toe.
      </p>

      <template v-else>
        <template v-for="item in feedItems" :key="item.key">
          <div v-if="item.kind === 'date'" class="ic-update-feed__date">
            <span>{{ item.label }}</span>
          </div>

          <div
            v-else-if="item.kind === 'status'"
            class="ic-update-feed__system"
          >
            <span :class="['ic-update-feed__status', statusBadgeClass(item.entry.status)]">
              {{ item.entry.previousStatus }} → {{ item.entry.status }}
            </span>
            <time>{{ formatTime(item.entry.createdAt) }}</time>
          </div>

          <article
            v-else
            class="ic-update-feed__bubble"
          >
            <p class="ic-update-feed__text">
              {{ item.text }}
            </p>
            <footer class="ic-update-feed__meta">
              <span v-if="item.entry.updatedBy" class="ic-update-feed__author">
                {{ item.entry.updatedBy }}
              </span>
              <time>{{ formatTime(item.entry.createdAt) }}</time>
            </footer>
          </article>
        </template>
      </template>
    </div>

    <form
      v-if="incident"
      class="ic-update-feed__composer"
      @submit.prevent="submitNote"
    >
      <Message v-if="error && entries.length > 0" severity="warn" :closable="false" class="ic-update-feed__composer-error">
        {{ error }}
      </Message>

      <InputText
        v-model="author"
        class="ic-update-feed__author-input"
        placeholder="Naam"
        :disabled="submitting"
      />

      <div class="ic-update-feed__composer-row">
        <Textarea
          v-model="note"
          class="ic-update-feed__input"
          rows="2"
          auto-resize
          placeholder="Typ een update…"
          :disabled="submitting"
          @keydown="handleComposerKeydown"
        />
        <Button
          type="submit"
          icon="pi pi-send"
          aria-label="Update versturen"
          :loading="submitting"
          :disabled="!note.trim() || submitting"
        />
      </div>
    </form>
  </section>
</template>

<style scoped>
.ic-update-feed {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  border-radius: 0.5rem;
  background: #f8fafc;
  border: 1px solid rgb(135 161 198 / 0.35);
}

.ic-update-feed__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid rgb(135 161 198 / 0.25);
  background: rgb(255 255 255 / 0.75);
}

.ic-update-feed__title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ic-brand-dark);
}

.ic-update-feed__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.375rem;
  height: 1.375rem;
  padding: 0 0.375rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--ic-brand-dark);
  background: rgb(135 161 198 / 0.2);
}

.ic-update-feed__messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.ic-update-feed__state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #64748b;
}

.ic-update-feed__date {
  display: flex;
  justify-content: center;
  margin: 0.25rem 0;
}

.ic-update-feed__date span {
  padding: 0.1875rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #64748b;
  background: rgb(148 163 184 / 0.18);
}

.ic-update-feed__system {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  margin: 0.125rem 0;
  font-size: 0.6875rem;
  color: #64748b;
}

.ic-update-feed__status {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.ic-update-feed__status--open {
  background: rgb(34 197 94 / 0.15);
  color: #15803d;
}

.ic-update-feed__status--progress {
  background: rgb(249 115 22 / 0.15);
  color: #c2410c;
}

.ic-update-feed__status--closed {
  background: rgb(148 163 184 / 0.25);
  color: #475569;
}

.ic-update-feed__status--default {
  background: rgb(135 161 198 / 0.2);
  color: var(--ic-brand-dark);
}

.ic-update-feed__bubble {
  align-self: flex-start;
  max-width: 92%;
  padding: 0.625rem 0.75rem;
  border-radius: 0.75rem 0.75rem 0.75rem 0.25rem;
  background: #fff;
  border: 1px solid rgb(135 161 198 / 0.25);
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
}

.ic-update-feed__text {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: #1e293b;
  white-space: pre-wrap;
}

.ic-update-feed__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.375rem 0.625rem;
  margin-top: 0.375rem;
  font-size: 0.6875rem;
  color: #64748b;
}

.ic-update-feed__author {
  font-weight: 600;
  margin-right: auto;
}

.ic-update-feed__composer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid rgb(135 161 198 / 0.25);
  background: rgb(255 255 255 / 0.9);
}

.ic-update-feed__composer-error {
  margin: 0;
}

.ic-update-feed__author-input {
  width: 100%;
}

.ic-update-feed__composer-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.ic-update-feed__input {
  flex: 1;
  min-width: 0;
}

.ic-update-feed__composer :deep(.p-inputtext),
.ic-update-feed__composer :deep(.p-textarea) {
  width: 100%;
  font-size: 0.875rem;
}
</style>
