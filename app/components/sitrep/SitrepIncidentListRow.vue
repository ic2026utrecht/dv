<script setup lang="ts">
import type { Incident } from '~/types/models'
import {
  getIncidentSeverity,
  severityDotClass,
  severityLabel,
  severityRowBtnClass,
  type SitrepSeverity,
} from '~/utils/sitrepColors'

const props = defineProps<{
  incident: Incident
  unreadCount: number
  variant?: 'standalone' | 'child' | 'orphan' | 'group'
  parentLabel?: string
  childCount?: number
  expanded?: boolean
  severity?: SitrepSeverity
}>()

defineEmits<{
  open: []
  status: []
  toggle: []
}>()

const variant = computed(() => props.variant ?? 'standalone')

const resolvedSeverity = computed(() =>
  props.severity ?? getIncidentSeverity(props.incident),
)

function formatAge(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}u ${mins}m` : `${hours}u`
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return timestamp
  }
  return date.toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function unreadBadgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count)
}

function statusButtonLabel(status: string): string {
  switch (status) {
    case 'Open':
      return 'Status: Open — klik om bij te werken'
    case 'In behandeling':
      return 'Status: In behandeling — klik om bij te werken'
    case 'Afgesloten':
      return 'Status: Afgesloten — klik om bij te werken'
    default:
      return 'Status wijzigen'
  }
}
</script>

<template>
  <div
    :class="[
      'ic-sitrep-list__row',
      severityRowBtnClass(resolvedSeverity),
      `ic-sitrep-list__row--${variant}`,
    ]"
  >
    <button
      v-if="variant === 'group'"
      type="button"
      class="ic-sitrep-list__toggle"
      :aria-expanded="expanded"
      :aria-label="expanded ? 'Sub-incidenten inklappen' : 'Sub-incidenten uitklappen'"
      @click.stop="$emit('toggle')"
    >
      <i
        :class="['pi', expanded ? 'pi-chevron-down' : 'pi-chevron-right']"
        aria-hidden="true"
      />
    </button>
    <span
      v-if="unreadCount > 0"
      class="ic-sitrep-list__unread-badge"
      :aria-label="`${unreadCount} ongelezen updates`"
    >
      {{ unreadBadgeLabel(unreadCount) }}
    </span>
    <button
      type="button"
      class="ic-sitrep-list__open"
      @click="$emit('open')"
    >
      <span :class="severityDotClass(resolvedSeverity)" aria-hidden="true" />
      <div class="ic-sitrep-list__body">
        <div class="ic-sitrep-list__top">
          <span class="ic-sitrep-list__id">{{ incident.incidentId }}</span>
          <span class="ic-sitrep-list__badges">
            <span
              v-if="variant === 'group' && !expanded && childCount"
              class="ic-sitrep-list__sub-badge"
            >
              {{ childCount }} sub
            </span>
            <span
              v-else-if="variant === 'orphan'"
              class="ic-sitrep-list__sub-badge"
            >
              Sub van {{ parentLabel || incident.parentId }}
            </span>
            <span class="ic-sitrep-list__badge">{{ severityLabel(resolvedSeverity) }}</span>
          </span>
        </div>
        <p class="ic-sitrep-list__type">
          {{ incident.incidentTypeName }} · {{ incident.department }}
        </p>
        <p class="ic-sitrep-list__location">
          {{ incident.locationName }}
          <span v-if="incident.sector"> · {{ incident.sector }}</span>
        </p>
        <p v-if="incident.description" class="ic-sitrep-list__desc">
          {{ incident.description }}
        </p>
        <div class="ic-sitrep-list__meta">
          <span>{{ formatTime(incident.timestamp) }}</span>
          <span v-if="incident.isOpen">{{ formatAge(incident.ageMinutes) }} open</span>
          <span v-if="incident.reporter">Melder: {{ incident.reporter }}</span>
          <span v-if="incident.actionOwner">Actie: {{ incident.actionOwner }}</span>
          <span>{{ incident.status || 'Open' }}</span>
        </div>
      </div>
   
    </button>
    <button
      type="button"
      :class="[
        'ic-sitrep-list__status-btn',
        `ic-sitrep-list__status-btn--${(incident.status || 'Open').toLowerCase().replace(/\s+/g, '-')}`
      ]"
      :title="statusButtonLabel(incident.status || 'Open')"
      :aria-label="statusButtonLabel(incident.status || 'Open')"
      @click="$emit('status')"
    >
      <i class="pi pi-flag" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.ic-sitrep-list__row {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 0.375rem;
}

.ic-sitrep-list__row.ic-sitrep-row-btn {
  padding: 0;
  gap: 0;
}

.ic-sitrep-list__row--child {
  font-size: 0.9375em;
}

.ic-sitrep-list__row--child .ic-sitrep-list__open {
  padding: 0.5rem 0.75rem;
}

.ic-sitrep-list__toggle {
  flex-shrink: 0;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  margin-left: 0.375rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--ic-brand-dark);
  cursor: pointer;
}

.ic-sitrep-list__toggle:hover {
  background: rgb(45 46 126 / 0.08);
}

.ic-sitrep-list__toggle:focus-visible {
  outline: 2px solid var(--ic-brand);
  outline-offset: 2px;
}

.ic-sitrep-list__open {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 0.75rem;
  padding: 0.75rem;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.ic-sitrep-list__row:hover .ic-sitrep-list__open {
  box-shadow: none;
}

.ic-sitrep-list__row:hover {
  box-shadow: inset 0 0 0 1px rgb(45 46 126 / 0.12);
}

.ic-sitrep-list__open:focus-visible {
  outline: 2px solid var(--ic-brand);
  outline-offset: 2px;
}

.ic-sitrep-list__badges {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.ic-sitrep-list__sub-badge {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background: rgb(45 46 126 / 0.08);
  color: var(--ic-brand-dark);
  white-space: nowrap;
}

.ic-sitrep-list__unread-badge {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.3125rem;
  border-radius: 9999px;
  background: var(--ic-orange);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}

.ic-sitrep-list__status-btn {
  flex-shrink: 0;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  margin-right: 0.375rem;
  border: 1px solid rgb(135 161 198 / 0.45);
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 0.85);
  color: var(--ic-brand-dark);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.ic-sitrep-list__status-btn:hover {
  background: #fff;
  border-color: var(--ic-brand);
  color: var(--ic-brand);
}

.ic-sitrep-list__status-btn:focus-visible {
  outline: 2px solid var(--ic-brand);
  outline-offset: 2px;
}

.ic-sitrep-list__status-btn--open {
  color: #f97316;
  border-color: rgb(249 115 22 / 0.3);
}

.ic-sitrep-list__status-btn--open:hover {
  background: rgb(249 115 22 / 0.08);
  border-color: #f97316;
  color: #c2410c;
}

.ic-sitrep-list__status-btn--in-behandeling {
  color: #22c55e;
  border-color: rgb(34 197 94 / 0.3);
}

.ic-sitrep-list__status-btn--in-behandeling:hover {
  background: rgb(34 197 94 / 0.08);
  border-color: #22c55e;
  color: #15803d;
}

.ic-sitrep-list__status-btn--afgesloten {
  color: #64748b;
  border-color: rgb(148 163 184 / 0.3);
}

.ic-sitrep-list__status-btn--afgesloten:hover {
  background: rgb(148 163 184 / 0.1);
  border-color: #64748b;
  color: #475569;
}
</style>
