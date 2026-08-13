<script setup lang="ts">
import type { SitrepSummary } from '~/types/models'

defineProps<{
  summary: SitrepSummary
  lastUpdated: Date | null
  loading?: boolean
  refreshing?: boolean
}>()

const emit = defineEmits<{
  create: []
  refresh: []
}>()

const chips = [
  { key: 'open', label: 'Open', variant: 'open' },
  { key: 'criticalOpen', label: 'Critical', variant: 'critical' },
  { key: 'hoogOpen', label: 'Hoog', variant: 'high' },
  { key: 'closed', label: 'Afgesloten', variant: 'muted' },
] as const
</script>

<template>
  <section class="ic-sitrep-kpis">
    <div class="ic-sitrep-kpis__main">
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
      <p v-else-if="loading" class="ic-sitrep-kpis__updated ic-sitrep-kpis__updated--loading">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        Laden…
      </p>
    </div>

    <div class="ic-sitrep-kpis__actions">
      <button
        type="button"
        class="ic-sitrep-kpis__create"
        aria-label="Nieuwe melding"
        @click="emit('create')"
      >
        <i class="pi pi-plus" aria-hidden="true" />
        <span class="ic-sitrep-kpis__label-full">Nieuwe melding</span>
        <span class="ic-sitrep-kpis__label-short">Nieuw</span>
      </button>
      <button
        type="button"
        class="ic-sitrep-kpis__refresh"
        aria-label="Vernieuwen"
        :disabled="refreshing || loading"
        @click="emit('refresh')"
      >
        <i class="pi pi-refresh" :class="{ 'pi-spin': refreshing || loading }" aria-hidden="true" />
        <span class="ic-sitrep-kpis__label-full">Vernieuwen</span>
      </button>
    </div>
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

.ic-sitrep-kpis__main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex-wrap: wrap;
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

.ic-sitrep-kpi-chip__dot--high {
  background: var(--ic-high);
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

.ic-sitrep-kpis__updated--loading {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--ic-brand);
}

.ic-sitrep-kpis__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.ic-sitrep-kpis__create,
.ic-sitrep-kpis__refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.ic-sitrep-kpis__create {
  border: none;
  background: var(--ic-brand);
  color: #fff;
}

.ic-sitrep-kpis__create:hover {
  background: var(--ic-brand-dark);
}

.ic-sitrep-kpis__refresh {
  border: 1px solid rgb(135 161 198 / 0.55);
  background: #fff;
  color: var(--ic-brand);
}

.ic-sitrep-kpis__refresh:hover:not(:disabled) {
  background: rgb(135 161 198 / 0.12);
}

.ic-sitrep-kpis__refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ic-sitrep-kpis__label-short {
  display: none;
}

@media (max-width: 900px) {
  .ic-sitrep-kpis {
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4375rem 0.625rem;
  }

  .ic-sitrep-kpis__main {
    flex: 1 1 auto;
    min-width: 0;
    flex-wrap: nowrap;
    gap: 0.375rem;
  }

  .ic-sitrep-kpis__row {
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 0.375rem;
    scrollbar-width: none;
  }

  .ic-sitrep-kpis__row::-webkit-scrollbar {
    display: none;
  }

  .ic-sitrep-kpi-chip__label {
    display: none;
  }

  .ic-sitrep-kpi-chip__dot {
    width: 1.25rem;
    height: 1.25rem;
    font-size: 0.625rem;
  }

  .ic-sitrep-kpis__updated {
    font-size: 0.5625rem;
  }

  .ic-sitrep-kpis__actions {
    width: auto;
    gap: 0.3125rem;
  }

  .ic-sitrep-kpis__create,
  .ic-sitrep-kpis__refresh {
    padding: 0.375rem 0.5rem;
    font-size: 0.6875rem;
  }

  .ic-sitrep-kpis__label-full {
    display: none;
  }

  .ic-sitrep-kpis__label-short {
    display: inline;
  }
}

@media (max-width: 768px) {
  .ic-sitrep-kpis {
    flex-wrap: nowrap;
  }

  .ic-sitrep-kpis__actions {
    width: auto;
    justify-content: flex-end;
  }
}
</style>
