<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <article class="ic-sitrep-analytics-card">
    <header class="ic-sitrep-analytics-card__header">
      <div>
        <h3 class="ic-sitrep-analytics-card__title">
          {{ title }}
        </h3>
        <p v-if="description" class="ic-sitrep-analytics-card__desc">
          {{ description }}
        </p>
      </div>
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
  padding: 0.75rem 0.875rem 0.5rem;
  border-bottom: 1px solid rgb(135 161 198 / 0.15);
  background: linear-gradient(180deg, rgb(248 250 252 / 0.95), #fff);
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
