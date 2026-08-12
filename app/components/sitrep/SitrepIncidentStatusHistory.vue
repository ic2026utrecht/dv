<script setup lang="ts">
import type { IncidentStatus, IncidentStatusUpdate } from '~/types/models'

const props = defineProps<{
  incidentId: string | null
  refreshKey?: number
}>()

const { $api } = useNuxtApp()

const entries = ref<IncidentStatusUpdate[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

function statusBadgeClass(status: IncidentStatus): string {
  switch (status) {
    case 'Open':
      return 'ic-status-history__badge--open'
    case 'In behandeling':
      return 'ic-status-history__badge--progress'
    case 'Afgesloten':
      return 'ic-status-history__badge--closed'
    default:
      return 'ic-status-history__badge--default'
  }
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function transitionLabel(entry: IncidentStatusUpdate): string {
  if (!entry.previousStatus) {
    return entry.status
  }
  return `${entry.previousStatus} → ${entry.status}`
}

async function loadHistory() {
  if (!props.incidentId) {
    entries.value = []
    error.value = null
    return
  }

  loading.value = true
  error.value = null

  try {
    const response = await $api.incidents.getStatusHistory(props.incidentId)
    entries.value = response.data ?? []
  }
  catch (err: unknown) {
    entries.value = []
    error.value = err instanceof Error ? err.message : 'Statusgeschiedenis laden mislukt'
  }
  finally {
    loading.value = false
  }
}

watch(
  () => [props.incidentId, props.refreshKey] as const,
  () => {
    loadHistory()
  },
  { immediate: true },
)
</script>

<template>
  <section class="ic-status-history" aria-label="Statusgeschiedenis">
    <div v-if="loading" class="ic-status-history__state">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>Statusgeschiedenis laden…</span>
    </div>

    <Message v-else-if="error" severity="warn" :closable="false">
      {{ error }}
    </Message>

    <p v-else-if="!incidentId" class="ic-status-history__state">
      Geen incident geselecteerd
    </p>

    <p v-else-if="entries.length === 0" class="ic-status-history__state">
      Nog geen statuswijzigingen geregistreerd
    </p>

    <ol v-else class="ic-status-history__list">
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="ic-status-history__item"
      >
        <div class="ic-status-history__rail" aria-hidden="true">
          <span class="ic-status-history__dot" />
          <span class="ic-status-history__line" />
        </div>

        <div class="ic-status-history__content">
          <time class="ic-status-history__time">
            {{ formatTimestamp(entry.createdAt) }}
          </time>

          <div class="ic-status-history__head">
            <span :class="['ic-status-history__badge', statusBadgeClass(entry.status)]">
              {{ transitionLabel(entry) }}
            </span>
            <span v-if="entry.updatedBy" class="ic-status-history__by">
              door {{ entry.updatedBy }}
            </span>
          </div>

          <p v-if="entry.notes" class="ic-status-history__notes">
            {{ entry.notes }}
          </p>

          <dl v-if="entry.actionOwner || entry.closedBy || entry.closureResult" class="ic-status-history__meta">
            <div v-if="entry.actionOwner">
              <dt>Actiehouder</dt>
              <dd>{{ entry.actionOwner }}</dd>
            </div>
            <div v-if="entry.closedBy">
              <dt>Afgesloten door</dt>
              <dd>{{ entry.closedBy }}</dd>
            </div>
            <div v-if="entry.closureResult">
              <dt>Resultaat</dt>
              <dd>{{ entry.closureResult }}</dd>
            </div>
          </dl>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.ic-status-history__state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #64748b;
}

.ic-status-history__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ic-status-history__item {
  display: flex;
  gap: 0.75rem;
  padding-bottom: 0.875rem;
}

.ic-status-history__item:last-child {
  padding-bottom: 0;
}

.ic-status-history__item:last-child .ic-status-history__line {
  display: none;
}

.ic-status-history__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 0.75rem;
  padding-top: 0.25rem;
}

.ic-status-history__dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 9999px;
  background: var(--ic-brand);
  box-shadow: 0 0 0 2px rgb(135 161 198 / 0.35);
}

.ic-status-history__line {
  flex: 1;
  width: 2px;
  margin-top: 0.375rem;
  background: rgb(135 161 198 / 0.45);
}

.ic-status-history__content {
  min-width: 0;
  flex: 1;
}

.ic-status-history__time {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #64748b;
}

.ic-status-history__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem 0.625rem;
  margin-top: 0.25rem;
}

.ic-status-history__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.ic-status-history__badge--open {
  background: rgb(34 197 94 / 0.15);
  color: #15803d;
}

.ic-status-history__badge--progress {
  background: rgb(249 115 22 / 0.15);
  color: #c2410c;
}

.ic-status-history__badge--closed {
  background: rgb(148 163 184 / 0.25);
  color: #475569;
}

.ic-status-history__badge--default {
  background: rgb(135 161 198 / 0.2);
  color: var(--ic-brand-dark);
}

.ic-status-history__by {
  font-size: 0.75rem;
  color: #64748b;
}

.ic-status-history__notes {
  margin-top: 0.375rem;
  font-size: 0.8125rem;
  color: #334155;
  white-space: pre-wrap;
}

.ic-status-history__meta {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: 0.375rem 0.75rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
}

.ic-status-history__meta dt {
  font-weight: 600;
  color: #64748b;
}

.ic-status-history__meta dd {
  margin: 0;
  color: #334155;
}
</style>
