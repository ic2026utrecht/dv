<script setup lang="ts">
import type { Department, Priority, WhatsappMessage } from '~/types/models'
import { DEPARTMENTS, PRIORITIES } from '~/constants/incident'

const visible = defineModel<boolean>({ default: false })

const props = defineProps<{
  message: WhatsappMessage | null
}>()

const emit = defineEmits<{
  created: [incidentId: string]
}>()

const { $api } = useNuxtApp()
const { fetchConfig, config } = useIncidents()

const department = ref<Department>('Dienstverlening')
const locationId = ref<string | null>(null)
const incidentTypeId = ref<string | null>(null)
const priority = ref<Priority>('Middel')
const description = ref('')
const reporter = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

const locationOptions = computed(() =>
  (config.value?.locations ?? [])
    .filter(l => l.active)
    .map(l => ({ label: l.name, value: l.id })),
)

const typeOptions = computed(() =>
  (config.value?.incidentTypes ?? [])
    .filter(t => t.department === department.value)
    .map(t => ({ label: t.name, value: t.id })),
)

watch(visible, async (open) => {
  if (!open || !props.message) return
  error.value = null
  description.value = props.message.body
  reporter.value = [props.message.senderName, props.message.senderPhone]
    .filter(Boolean)
    .join(' — ')
  department.value = 'Dienstverlening'
  locationId.value = null
  incidentTypeId.value = null
  priority.value = 'Middel'
  try {
    await fetchConfig()
  }
  catch {
    // surfaced via form error if needed
  }
})

watch(department, () => {
  incidentTypeId.value = null
})

async function submit() {
  if (!props.message) return
  if (!locationId.value || !incidentTypeId.value) {
    error.value = 'Kies een locatie en incidenttype'
    return
  }
  submitting.value = true
  error.value = null
  try {
    const incidentId = await $api.whatsapp.createIncidentFromMessage({
      messageId: props.message.id,
      department: department.value,
      locationId: locationId.value,
      incidentTypeId: incidentTypeId.value,
      priority: priority.value,
      description: description.value.trim(),
      reporter: reporter.value.trim(),
    })
    emit('created', incidentId)
    visible.value = false
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Aanmaken mislukt'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    position="right"
    header="Incident vanuit WhatsApp"
    class="ic-wa-create-drawer"
    :style="{ width: 'min(100vw, 26rem)' }"
  >
    <Message v-if="error" severity="error" :closable="false" class="mb-3">
      {{ error }}
    </Message>

    <div class="ic-wa-create-drawer__form">
      <label class="ic-wa-field">
        <span>Afdeling</span>
        <Select
          v-model="department"
          :options="DEPARTMENTS.map(d => ({ label: d, value: d }))"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </label>

      <label class="ic-wa-field">
        <span>Locatie</span>
        <Select
          v-model="locationId"
          :options="locationOptions"
          option-label="label"
          option-value="value"
          placeholder="Kies locatie"
          class="w-full"
          filter
        />
      </label>

      <label class="ic-wa-field">
        <span>Type</span>
        <Select
          v-model="incidentTypeId"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          placeholder="Kies type"
          class="w-full"
        />
      </label>

      <label class="ic-wa-field">
        <span>Prioriteit</span>
        <Select
          v-model="priority"
          :options="PRIORITIES.map(p => ({ label: p, value: p }))"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </label>

      <label class="ic-wa-field">
        <span>Melder</span>
        <InputText v-model="reporter" class="w-full" />
      </label>

      <label class="ic-wa-field">
        <span>Beschrijving</span>
        <Textarea
          v-model="description"
          class="w-full"
          rows="5"
          auto-resize
        />
      </label>

      <Button
        label="Incident aanmaken"
        icon="pi pi-plus"
        class="w-full"
        :loading="submitting"
        @click="submit"
      />
    </div>
  </Drawer>
</template>

<style scoped>
.ic-wa-create-drawer__form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.ic-wa-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  font-weight: 500;
}
</style>
