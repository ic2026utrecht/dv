<script setup lang="ts">
const visible = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  created: [incidentId: string]
}>()

function close() {
  visible.value = false
}

function onSubmitted(incidentId: string) {
  visible.value = false
  emit('created', incidentId)
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Nieuwe melding"
    class="ic-sitrep-create-dialog"
    :style="{ width: 'min(100vw - 2rem, 36rem)' }"
    :draggable="false"
    block-scroll
    content-class="ic-sitrep-create-dialog__content"
    @hide="close"
  >
    <IncidentForm
      v-if="visible"
      in-dialog
      show-department-selection
      @submitted="onSubmitted"
    />
  </Dialog>
</template>

<style scoped>
:deep(.ic-sitrep-create-dialog__content) {
  padding: 0;
  max-height: min(85dvh, 720px);
  overflow-y: auto;
}
</style>
