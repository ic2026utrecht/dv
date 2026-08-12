<script setup lang="ts">
defineProps<{
  label: string
  hint?: string
  required?: boolean
  htmlFor?: string
  invalid?: boolean
}>()
</script>

<template>
  <div class="ic-field" :class="{ 'ic-field--invalid': invalid }">
    <label v-if="htmlFor" class="ic-label" :for="htmlFor">
      {{ label }}
      <span v-if="required" class="ic-required" aria-hidden="true"> *</span>
    </label>
    <span v-else class="ic-label">
      {{ label }}
      <span v-if="required" class="ic-required" aria-hidden="true"> *</span>
    </span>
    <span v-if="hint" class="ic-label-hint">{{ hint }}</span>
    <slot />
  </div>
</template>
