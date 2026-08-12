<script setup lang="ts">
import type { Incident, IncidentStatus, IncidentUpdate } from '~/types/models'

const visible = defineModel<boolean>({ default: false })

const props = defineProps<{
  incident: Incident | null
  saving?: boolean
}>()

const emit = defineEmits<{
  save: [payload: IncidentUpdate]
}>()

const { displayName, fetchMe } = useStaffAuth()

const STATUS_OPTIONS = [
  { value: 'Open', label: 'Open', icon: 'pi-flag' },
  { value: 'In behandeling', label: 'In behandeling', icon: 'pi-flag' },
  { value: 'Afgesloten', label: 'Afgesloten', icon: 'pi-flag' },
] as const

const form = reactive({
  status: 'Open' as IncidentStatus,
  closedBy: '',
  closureResult: '',
  updateNotes: '',
  updatedBy: '',
})

const confirmStep = ref(false)
const idPrefix = 'sitrep-status'

const isClosed = computed(() => form.status === 'Afgesloten')

const currentStatus = computed(() => props.incident?.status || 'Open')

const statusChanged = computed(() => form.status !== currentStatus.value)

const hasUpdateNote = computed(() => form.updateNotes.trim().length > 0)

const canSubmit = computed(() => statusChanged.value || hasUpdateNote.value)

function resetForm(incident: Incident | null) {
  confirmStep.value = false
  if (!incident) {
    form.status = 'Open'
    form.closedBy = ''
    form.closureResult = ''
    form.updateNotes = ''
    form.updatedBy = ''
    return
  }

  form.status = incident.status || 'Open'
  form.closedBy = incident.closedBy || ''
  form.closureResult = incident.closureResult || ''
  form.updateNotes = ''
  form.updatedBy = displayName.value || incident.actionOwner || ''
}

watch(
  () => props.incident,
  async (incident) => {
    await fetchMe().catch(() => {})
    resetForm(incident)
    if (incident && form.status === 'Afgesloten' && !form.closedBy.trim() && displayName.value) {
      form.closedBy = displayName.value
    }
  },
  { immediate: true },
)

watch(visible, (open) => {
  if (open) {
    resetForm(props.incident)
    if (props.incident?.status === 'Afgesloten' && !form.closedBy.trim() && displayName.value) {
      form.closedBy = displayName.value
    }
  }
})

watch(
  () => form.status,
  (status) => {
    if (status === 'Afgesloten' && !form.closedBy.trim() && displayName.value) {
      form.closedBy = displayName.value
    }
  },
)

watch(displayName, (name) => {
  if (name && !form.updatedBy.trim()) {
    form.updatedBy = name
  }
})

function close() {
  visible.value = false
}

function statusLabel(status: IncidentStatus): string {
  return STATUS_OPTIONS.find(option => option.value === status)?.label ?? status
}

function requestConfirm() {
  if (!props.incident || !canSubmit.value) {
    return
  }
  confirmStep.value = true
}

function backToForm() {
  confirmStep.value = false
}

function submit() {
  if (!props.incident) {
    return
  }

  const payload: IncidentUpdate = {
    incidentId: props.incident.incidentId,
    status: form.status,
    updateNotes: form.updateNotes.trim() || undefined,
    updatedBy: form.updatedBy.trim() || undefined,
  }

  if (isClosed.value) {
    payload.closedBy = form.closedBy.trim() || undefined
    payload.closureResult = form.closureResult.trim() || undefined
  }

  emit('save', payload)
}

const confirmMessage = computed(() => {
  const parts: string[] = []

  if (statusChanged.value) {
    parts.push(
      `Status wijzigen van «${statusLabel(currentStatus.value)}» naar «${statusLabel(form.status)}».`,
    )
  }

  if (hasUpdateNote.value) {
    parts.push('Er wordt een update toegevoegd aan het incident.')
  }

  if (isClosed.value && statusChanged.value) {
    parts.push('Sluitingsgegevens worden opgeslagen.')
  }

  return parts.join(' ')
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="incident ? `${incident.incidentId} — status` : 'Status wijzigen'"
    class="ic-sitrep-status-dialog"
    :style="{ width: 'min(100vw - 2rem, 28rem)' }"
    :draggable="false"
    :dismissable-mask="true"
    @hide="close"
  >
    <template v-if="incident">
      <div v-if="!confirmStep" class="ic-sitrep-status-dialog__form ic-form">
        <IcFormField label="Status" :html-for="`${idPrefix}-status`">
          <Select
            :id="`${idPrefix}-status`"
            v-model="form.status"
            :options="STATUS_OPTIONS"
            option-label="label"
            option-value="value"
            class="ic-field w-full"
          >
            <template #value="slotProps">
              <div v-if="slotProps.value" class="ic-status-option">
                <i :class="[
                  'pi',
                  STATUS_OPTIONS.find(opt => opt.value === slotProps.value)?.icon,
                  `ic-status-icon--${slotProps.value.toLowerCase().replace(/\s+/g, '-')}`
                ]" />
                <span>{{ slotProps.placeholder || STATUS_OPTIONS.find(opt => opt.value === slotProps.value)?.label }}</span>
              </div>
            </template>
            <template #option="slotProps">
              <div class="ic-status-option">
                <i :class="[
                  'pi',
                  slotProps.option.icon,
                  `ic-status-icon--${slotProps.option.value.toLowerCase().replace(/\s+/g, '-')}`
                ]" />
                <span>{{ slotProps.option.label }}</span>
              </div>
            </template>
          </Select>
        </IcFormField>

        <SitrepIncidentClosureFields
          v-if="isClosed"
          v-model:closed-by="form.closedBy"
          v-model:closure-result="form.closureResult"
          :id-prefix="idPrefix"
          class="mt-4"
        />

        <IcFormField
          label="Update / notitie"
          :html-for="`${idPrefix}-notes`"
          hint="Optioneel — wordt toegevoegd aan de updategeschiedenis"
          class="mt-4"
        >
          <Textarea
            :id="`${idPrefix}-notes`"
            v-model="form.updateNotes"
            class="ic-field w-full"
            rows="3"
            auto-resize
            placeholder="Bijv. situatie ter plaatse of vervolgactie…"
          />
        </IcFormField>

        <IcFormField label="Door" :html-for="`${idPrefix}-updated-by`" class="mt-4">
          <InputText
            :id="`${idPrefix}-updated-by`"
            v-model="form.updatedBy"
            class="ic-field w-full"
            placeholder="Naam"
          />
        </IcFormField>

        <p v-if="!canSubmit" class="ic-sitrep-status-dialog__hint">
          Wijzig de status of voeg een update toe om door te gaan.
        </p>
      </div>

      <div v-else class="ic-sitrep-status-dialog__confirm">
        <p class="ic-sitrep-status-dialog__confirm-text">
          {{ confirmMessage }}
        </p>

        <blockquote v-if="hasUpdateNote" class="ic-sitrep-status-dialog__note-preview">
          {{ form.updateNotes.trim() }}
        </blockquote>
      </div>
    </template>

    <template #footer>
      <template v-if="!confirmStep">
        <Button
          label="Annuleren"
          severity="secondary"
          text
          :disabled="saving"
          @click="close"
        />
        <Button
          label="Bevestigen…"
          icon="pi pi-check"
          :disabled="!incident || !canSubmit || saving"
          @click="requestConfirm"
        />
      </template>
      <template v-else>
        <Button
          label="Terug"
          severity="secondary"
          text
          :disabled="saving"
          @click="backToForm"
        />
        <Button
          label="Opslaan"
          icon="pi pi-check"
          :loading="saving"
          :disabled="!incident || saving"
          @click="submit"
        />
      </template>
    </template>
  </Dialog>
</template>

<style scoped>
.ic-sitrep-status-dialog__form :deep(.p-select),
.ic-sitrep-status-dialog__form :deep(.p-inputtext),
.ic-sitrep-status-dialog__form :deep(.p-textarea) {
  width: 100%;
}

.ic-sitrep-status-dialog__hint {
  margin: 0.75rem 0 0;
  font-size: 0.8125rem;
  color: #64748b;
}

.ic-sitrep-status-dialog__confirm-text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: #334155;
}

.ic-sitrep-status-dialog__note-preview {
  margin: 1rem 0 0;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border-left: 3px solid var(--ic-brand);
  background: var(--ic-surface-muted);
  font-size: 0.8125rem;
  line-height: 1.45;
  color: #475569;
  white-space: pre-wrap;
}

.ic-status-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ic-status-option i {
  font-size: 0.875rem;
}

.ic-status-icon--open {
  color: #f97316;
}

.ic-status-icon--in-behandeling {
  color: #22c55e;
}

.ic-status-icon--afgesloten {
  color: #64748b;
}
</style>
