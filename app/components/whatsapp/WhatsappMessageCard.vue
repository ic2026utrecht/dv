<script setup lang="ts">
import type { WhatsappMessage } from '~/types/models'

const props = defineProps<{
  message: WhatsappMessage
  selected: boolean
  expanded: boolean
}>()

const emit = defineEmits<{
  select: []
  handled: []
  flag: []
  reply: []
  link: []
  create: []
  toggleExpand: []
}>()

const longBody = computed(() => props.message.body.length > 220)
const displayBody = computed(() => {
  if (!longBody.value || props.expanded) return props.message.body
  return `${props.message.body.slice(0, 220)}…`
})

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function formatHandledAt(value: string | null): string {
  if (!value) return ''
  return formatTime(value)
}

const statusClass = computed(() => {
  switch (props.message.actionStatus) {
    case 'flagged':
      return 'ic-wa-card--flagged'
    case 'handled':
    case 'dismissed':
      return 'ic-wa-card--handled'
    default:
      return props.message.direction === 'in' ? 'ic-wa-card--new' : 'ic-wa-card--out'
  }
})
</script>

<template>
  <article
    class="ic-wa-card"
    :class="[statusClass, { 'ic-wa-card--selected': selected }]"
    tabindex="0"
    :aria-label="`Bericht van ${message.senderName || 'onbekend'}`"
    @click="emit('select')"
    @keydown.enter="emit('select')"
  >
    <header class="ic-wa-card__header">
      <div class="ic-wa-card__who">
        <span
          v-if="message.actionStatus === 'new' && message.direction === 'in'"
          class="ic-wa-card__unread"
          aria-label="Nieuw"
        />
        <strong>{{ message.senderName || message.senderPhone || 'Onbekend' }}</strong>
        <span class="ic-wa-card__group">{{ message.groupName }}</span>
      </div>
      <time class="ic-wa-card__time">{{ formatTime(message.receivedAt) }}</time>
    </header>

    <p class="ic-wa-card__body">
      {{ displayBody }}
    </p>
    <button
      v-if="longBody"
      type="button"
      class="ic-wa-card__more"
      @click.stop="emit('toggleExpand')"
    >
      {{ expanded ? 'minder' : 'meer…' }}
    </button>

    <p
      v-if="message.incidentId"
      class="ic-wa-card__incident"
    >
      <i class="pi pi-link" aria-hidden="true" />
      Gekoppeld: {{ message.incidentId }}
    </p>

    <p
      v-if="message.actionStatus === 'handled' || message.actionStatus === 'dismissed'"
      class="ic-wa-card__handled"
    >
      Afgehandeld
      <template v-if="message.handledBy">
        door {{ message.handledBy }}
      </template>
      <template v-if="message.handledAt">
        om {{ formatHandledAt(message.handledAt) }}
      </template>
    </p>

    <div class="ic-wa-card__actions" @click.stop>
      <Button
        v-if="message.actionStatus !== 'handled'"
        label="Afgehandeld"
        icon="pi pi-check"
        size="small"
        aria-label="Markeer als afgehandeld"
        @click="emit('handled')"
      />
      <Button
        icon="pi pi-flag"
        size="small"
        severity="warn"
        outlined
        aria-label="Markeren"
        @click="emit('flag')"
      />
      <Button
        icon="pi pi-link"
        size="small"
        severity="secondary"
        outlined
        aria-label="Koppel incident"
        @click="emit('link')"
      />
      <Button
        icon="pi pi-plus"
        size="small"
        severity="secondary"
        outlined
        aria-label="Maak incident"
        @click="emit('create')"
      />
      <Button
        icon="pi pi-reply"
        size="small"
        severity="secondary"
        outlined
        aria-label="Antwoorden"
        @click="emit('reply')"
      />
    </div>
  </article>
</template>
