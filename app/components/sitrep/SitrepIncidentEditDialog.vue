<script setup lang="ts">
import type { Incident, IncidentStatus } from '~/types/models'

const visible = defineModel<boolean>({ default: false })

const props = defineProps<{
  incident: Incident | null
  saving?: boolean
}>()

const emit = defineEmits<{
  save: [payload: {
    incidentId: string
    status: IncidentStatus
    actionOwner: string
    updateNotes: string
  }]
}>()

const STATUS_OPTIONS: { value: IncidentStatus, label: string }[] = [
  { value: 'Open', label: 'Open' },
  { value: 'In behandeling', label: 'In behandeling' },
  { value: 'Afgesloten', label: 'Afgesloten' },
]

const form = reactive({
  status: 'Open' as IncidentStatus,
  actionOwner: '',
  updateNotes: '',
})

watch(
  () => props.incident,
  (incident) => {
    if (!incident) {
      return
    }
    form.status = (incident.status || 'Open') as IncidentStatus
    form.actionOwner = incident.actionOwner || ''
    form.updateNotes = ''
  },
  { immediate: true },
)

function close() {
  visible.value = false
}

function submit() {
  if (!props.incident) {
    return
  }
  emit('save', {
    incidentId: props.incident.incidentId,
    status: form.status,
    actionOwner: form.actionOwner.trim(),
    updateNotes: form.updateNotes.trim(),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="incident ? incident.incidentId : 'Incident'"
    class="ic-sitrep-edit-dialog"
    :style="{ width: 'min(100vw - 2rem, 28rem)' }"
    :draggable="false"
    @hide="close"
  >
    <template v-if="incident">
      <div class="ic-sitrep-edit-dialog__summary">
        <p class="ic-sitrep-edit-dialog__type">
          {{ incident.incidentTypeName }} · {{ incident.department }}
        </p>
        <p class="ic-sitrep-edit-dialog__loc">
          {{ incident.locationName }}
          <span v-if="incident.sector"> · {{ incident.sector }}</span>
        </p>
        <p v-if="incident.description" class="ic-sitrep-edit-dialog__desc">
          {{ incident.description }}
        </p>
      </div>

      <div class="ic-sitrep-edit-dialog__form">
        <label class="ic-label" for="sitrep-status">Status</label>
        <Select
          id="sitrep-status"
          v-model="form.status"
          :options="STATUS_OPTIONS"
          option-label="label"
          option-value="value"
          class="ic-field w-full"
        />

        <label class="ic-label mt-4" for="sitrep-action-owner">Actiehouder</label>
        <InputText
          id="sitrep-action-owner"
          v-model="form.actionOwner"
          class="ic-field w-full"
          placeholder="Naam of functie"
        />

        <label class="ic-label mt-4" for="sitrep-update-notes">Update</label>
        <Textarea
          id="sitrep-update-notes"
          v-model="form.updateNotes"
          class="ic-field w-full"
          rows="3"
          placeholder="Korte toelichting bij statuswijziging"
          auto-resize
        />
      </div>
    </template>

    <template #footer>
      <Button
        label="Annuleren"
        severity="secondary"
        text
        :disabled="saving"
        @click="close"
      />
      <Button
        label="Opslaan"
        icon="pi pi-check"
        :loading="saving"
        :disabled="!incident"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.ic-sitrep-edit-dialog__summary {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: var(--ic-surface-muted);
  border: 1px solid rgb(135 161 198 / 0.35);
}

.ic-sitrep-edit-dialog__type {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ic-brand-dark);
}

.ic-sitrep-edit-dialog__loc {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: #64748b;
}

.ic-sitrep-edit-dialog__desc {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: #475569;
  line-height: 1.45;
}

.ic-sitrep-edit-dialog__form :deep(.p-inputtext),
.ic-sitrep-edit-dialog__form :deep(.p-textarea),
.ic-sitrep-edit-dialog__form :deep(.p-select) {
  width: 100%;
}
</style>
