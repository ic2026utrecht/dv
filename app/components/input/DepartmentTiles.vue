<script setup lang="ts">
import type { Department } from '~/types/models'

const model = defineModel<Department | null>({ required: true })

const departments: { value: Department, label: string, icon: string }[] = [
  { value: 'Parkeer', label: 'Parkeer', icon: 'pi pi-car' },
  { value: 'Dienstverlening', label: 'Dienstverlening', icon: 'pi pi-building' },
  { value: 'EHBO', label: 'EHBO', icon: 'pi pi-heart' },
]
</script>

<template>
  <div class="ic-dept-grid" role="radiogroup" aria-label="Afdeling">
    <button
      v-for="dept in departments"
      :key="dept.value"
      type="button"
      role="radio"
      :aria-checked="model === dept.value"
      class="ic-dept-tile"
      :class="{ 'ic-dept-tile--active': model === dept.value }"
      @click="model = dept.value"
    >
      <span class="ic-dept-icon">
        <i :class="dept.icon" aria-hidden="true" />
      </span>
      <span class="ic-dept-label">{{ dept.label }}</span>
    </button>
  </div>
</template>
