<script setup lang="ts">
const text = defineModel<string>({ default: '' })

defineProps<{
  recipientLabel: string
  submitting: boolean
}>()

const emit = defineEmits<{
  send: []
  cancel: []
}>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (text.value.trim()) emit('send')
  }
  if (event.key === 'Escape') {
    emit('cancel')
  }
}
</script>

<template>
  <form
    class="ic-wa-composer"
    @submit.prevent="emit('send')"
  >
    <p class="ic-wa-composer__label">
      Antwoord in {{ recipientLabel }}
    </p>
    <div class="ic-wa-composer__row">
      <Textarea
        v-model="text"
        class="ic-wa-composer__input"
        rows="2"
        auto-resize
        placeholder="Typ een antwoord… (Enter = versturen)"
        :disabled="submitting"
        @keydown="onKeydown"
      />
      <Button
        type="submit"
        icon="pi pi-send"
        aria-label="Antwoord versturen"
        :loading="submitting"
        :disabled="!text.trim() || submitting"
      />
      <Button
        type="button"
        icon="pi pi-times"
        severity="secondary"
        text
        aria-label="Annuleren"
        :disabled="submitting"
        @click="emit('cancel')"
      />
    </div>
  </form>
</template>
