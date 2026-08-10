<script setup lang="ts">
import type { Incident } from '~/types/models'
import { getIncidentSeverity, severityDotClass, severityLabel } from '~/utils/sitrepColors'

defineProps<{
  incidents: Incident[]
  embedded?: boolean
}>()

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return timestamp
  }
  return date.toLocaleString('nl-NL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAge(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}u ${mins}m` : `${hours}u`
}
</script>

<template>
  <section class="ic-sitrep-timeline" :class="{ 'ic-sitrep-timeline--embedded': embedded }">
    <header v-if="!embedded" class="ic-sitrep-timeline__header">
      <h2 class="ic-sitrep-timeline__title">
        Tijdlijn
      </h2>
      <span class="ic-sitrep-timeline__count">{{ incidents.length }} meldingen</span>
    </header>

    <p v-if="incidents.length === 0" class="ic-sitrep-timeline__empty">
      Nog geen incidenten geregistreerd
    </p>

    <ol v-else class="ic-sitrep-timeline__list">
      <li
        v-for="incident in incidents"
        :key="incident.incidentId"
        class="ic-sitrep-timeline__item"
        :class="{ 'ic-sitrep-timeline__item--closed': !incident.isOpen }"
      >
        <div class="ic-sitrep-timeline__rail">
          <span :class="severityDotClass(getIncidentSeverity(incident))" />
          <span class="ic-sitrep-timeline__line" aria-hidden="true" />
        </div>

        <div class="ic-sitrep-timeline__content">
          <time class="ic-sitrep-timeline__time">
            {{ formatTimestamp(incident.timestamp) }}
          </time>

          <div class="ic-sitrep-timeline__head">
            <span class="ic-sitrep-timeline__id">{{ incident.incidentId }}</span>
            <span class="ic-sitrep-timeline__badge">
              {{ severityLabel(getIncidentSeverity(incident)) }}
            </span>
          </div>

          <p class="ic-sitrep-timeline__summary">
            <strong>{{ incident.incidentTypeName }}</strong>
            · {{ incident.department }}
            · {{ incident.priority }}
          </p>

          <p class="ic-sitrep-timeline__location">
            {{ incident.locationName }}
            <span v-if="incident.zone"> ({{ incident.zone }})</span>
            <span v-if="incident.sector"> · Sector {{ incident.sector }}</span>
          </p>

          <p v-if="incident.description" class="ic-sitrep-timeline__desc">
            {{ incident.description }}
          </p>

          <dl class="ic-sitrep-timeline__details">
            <div v-if="incident.reporter">
              <dt>Melder</dt>
              <dd>{{ incident.reporter }}</dd>
            </div>
            <div v-if="incident.helpDeployed">
              <dt>Hulp ingezet</dt>
              <dd>{{ incident.helpDeployed }}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{{ incident.status || 'Open' }}</dd>
            </div>
            <div v-if="incident.actionOwner">
              <dt>Actiehouder</dt>
              <dd>{{ incident.actionOwner }}</dd>
            </div>
            <div v-if="incident.deadline">
              <dt>Deadline</dt>
              <dd>{{ formatTimestamp(incident.deadline) }}</dd>
            </div>
            <div v-if="incident.isOpen">
              <dt>Open sinds</dt>
              <dd>{{ formatAge(incident.ageMinutes) }}</dd>
            </div>
          </dl>
        </div>
      </li>
    </ol>
  </section>
</template>
