<script setup lang="ts">
import type { SitrepSummary } from '~/types/models'

defineProps<{
  summary: SitrepSummary
  lastUpdated: Date | null
}>()

const chips = [
  { key: 'open', label: 'Open', variant: 'open' },
  { key: 'criticalOpen', label: 'Critical', variant: 'critical' },
  { key: 'hoogOpen', label: 'Hoog', variant: 'warning' },
  { key: 'closed', label: 'Afgesloten', variant: 'muted' },
] as const
</script>

<template>
  <section class="ic-sitrep-kpis">
    <div class="ic-sitrep-kpis__row">
      <div
        v-for="chip in chips"
        :key="chip.key"
        class="ic-sitrep-kpi-chip"
        :title="chip.label"
      >
        <span
          class="ic-sitrep-kpi-chip__dot"
          :class="`ic-sitrep-kpi-chip__dot--${chip.variant}`"
        >
          {{ summary[chip.key] }}
        </span>
        <span class="ic-sitrep-kpi-chip__label">{{ chip.label }}</span>
      </div>
    </div>
    <p v-if="lastUpdated" class="ic-sitrep-kpis__updated">
      {{ lastUpdated.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) }}
    </p>
  </section>
</template>

<style scoped>
.ic-sitrep-kpis {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.375rem 1rem;
  border-bottom: 1px solid rgb(135 161 198 / 0.25);
  background: var(--ic-surface);
}

.ic-sitrep-kpis__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.625rem 0.875rem;
}

.ic-sitrep-kpi-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.ic-sitrep-kpi-chip__dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  flex-shrink: 0;
}

.ic-sitrep-kpi-chip__dot--open {
  background: var(--ic-brand);
}

.ic-sitrep-kpi-chip__dot--critical {
  background: var(--ic-critical);
}

.ic-sitrep-kpi-chip__dot--warning {
  background: var(--ic-orange);
}

.ic-sitrep-kpi-chip__dot--muted {
  background: #94a3b8;
}

.ic-sitrep-kpi-chip__label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
}

.ic-sitrep-kpis__updated {
  margin: 0;
  font-size: 0.625rem;
  color: #94a3b8;
  white-space: nowrap;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .ic-sitrep-kpis {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
  }
}
</style>
