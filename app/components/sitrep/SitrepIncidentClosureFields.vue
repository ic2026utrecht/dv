<script setup lang="ts">
const closedBy = defineModel<string>('closedBy', { required: true })
const closureResult = defineModel<string>('closureResult', { required: true })

defineProps<{
  idPrefix: string
}>()
</script>

<template>
  <section class="ic-sitrep-closure-fields">
    <h3 class="ic-sitrep-closure-fields__heading">
      Afsluiting
    </h3>

    <IcFormField label="Afgesloten door" :html-for="`${idPrefix}-closed-by`">
      <InputText
        :id="`${idPrefix}-closed-by`"
        v-model="closedBy"
        class="ic-field w-full"
      />
    </IcFormField>

    <IcFormField
      label="Afsluiting / resultaat"
      :html-for="`${idPrefix}-closure-result`"
      class="mt-4"
    >
      <Textarea
        :id="`${idPrefix}-closure-result`"
        v-model="closureResult"
        class="ic-field w-full"
        rows="3"
        auto-resize
      />
    </IcFormField>
  </section>
</template>

<style scoped>
.ic-sitrep-closure-fields {
  padding: 0.875rem;
  border-radius: 0.5rem;
  background: var(--ic-surface-muted);
  border: 1px solid rgb(135 161 198 / 0.35);
}

.ic-sitrep-closure-fields__heading {
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ic-brand-dark);
}

.ic-sitrep-closure-fields :deep(.p-inputtext),
.ic-sitrep-closure-fields :deep(.p-textarea) {
  width: 100%;
}
</style>
