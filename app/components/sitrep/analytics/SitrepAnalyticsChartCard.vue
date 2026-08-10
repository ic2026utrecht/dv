<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  removable?: boolean
}>()

const emit = defineEmits<{
  remove: []
}>()
</script>

<template>
  <article class="ic-sitrep-analytics-card">
    <header class="ic-sitrep-analytics-card__header">
      <div class="ic-sitrep-analytics-card__heading">
        <h3 class="ic-sitrep-analytics-card__title">
          {{ title }}
        </h3>
        <p v-if="description" class="ic-sitrep-analytics-card__desc">
          {{ description }}
        </p>
      </div>
      <button
        v-if="removable"
        type="button"
        class="ic-sitrep-analytics-card__remove"
        title="Grafiek verbergen"
        aria-label="Grafiek verbergen"
        @click="emit('remove')"
      >
        <i class="pi pi-times" aria-hidden="true" />
      </button>
    </header>
    <div class="ic-sitrep-analytics-card__body">
      <slot />
    </div>
  </article>
</template>

<style scoped>
.ic-sitrep-analytics-card {
  display: flex;
  flex-direction: column;
  min-height: 16rem;
  border: 1px solid rgb(135 161 198 / 0.28);
  border-radius: 0.75rem;
  background: #fff;
  overflow: hidden;
}

.ic-sitrep-analytics-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem 0.5rem;
  border-bottom: 1px solid rgb(135 161 198 / 0.15);
  background: linear-gradient(180deg, rgb(248 250 252 / 0.95), #fff);
}

.ic-sitrep-analytics-card__heading {
  min-width: 0;
}

.ic-sitrep-analytics-card__remove {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.625rem;
  height: 1.625rem;
  margin: -0.125rem -0.125rem 0 0;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.ic-sitrep-analytics-card__remove:hover {
  background: rgb(153 27 27 / 0.08);
  color: var(--ic-critical, #991b1b);
}

.ic-sitrep-analytics-card__title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--ic-brand-dark);
}

.ic-sitrep-analytics-card__desc {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.35;
}

.ic-sitrep-analytics-card__body {
  position: relative;
  flex: 1 1 auto;
  min-height: 12rem;
  padding: 0.625rem 0.75rem 0.75rem;
}
</style>
