<script setup lang="ts">
import type { SelectOption } from '~/types/models'

const model = defineModel<string | null>({ required: true })

defineProps<{
  options: SelectOption[]
  variant?: 'default' | 'priority'
}>()
</script>

<template>
  <div
    class="ic-choice-row"
    :class="{ 'ic-choice-row--priority': variant === 'priority' }"
    role="radiogroup"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="model === opt.value"
      class="ic-choice-btn"
      :class="[
        variant === 'priority' ? `ic-choice-btn--${String(opt.value).toLowerCase()}` : '',
        { 'ic-choice-btn--selected': model === opt.value },
      ]"
      @click="model = opt.value"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
