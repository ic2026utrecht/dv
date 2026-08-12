<script setup lang="ts">
import type {
  WhatsappFeedPeriodFilter,
  WhatsappFeedStatusFilter,
  WhatsappMessage,
} from '~/types/models'

const props = defineProps<{
  messages: WhatsappMessage[]
  selectedMessageId: string | null
  loading: boolean
  statusFilter: WhatsappFeedStatusFilter
  periodFilter: WhatsappFeedPeriodFilter
  connectionStatus: string | null
  hasMonitoredGroups: boolean
  isAdmin: boolean
}>()

const emit = defineEmits<{
  'update:statusFilter': [value: WhatsappFeedStatusFilter]
  'update:periodFilter': [value: WhatsappFeedPeriodFilter]
  'update:selectedMessageId': [value: string | null]
  handled: [id: string]
  flag: [id: string]
  reply: [id: string]
  link: [id: string]
  create: [id: string]
  openSetup: []
}>()

const feedRef = ref<HTMLElement | null>(null)
const stickToBottom = ref(true)
const showJump = ref(false)
const expandedIds = ref<Set<string>>(new Set())

type FeedItem
  = | { kind: 'date', key: string, label: string }
    | { kind: 'message', key: string, message: WhatsappMessage }

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDateSeparator(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Vandaag'
  if (diffDays === 1) return 'Gisteren'
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const feedItems = computed(() => {
  const items: FeedItem[] = []
  let lastDate = ''
  for (const message of props.messages) {
    const dayKey = startOfDay(new Date(message.receivedAt)).toISOString()
    if (dayKey !== lastDate) {
      lastDate = dayKey
      items.push({
        kind: 'date',
        key: `date-${dayKey}`,
        label: formatDateSeparator(message.receivedAt),
      })
    }
    items.push({ kind: 'message', key: message.id, message })
  }
  return items
})

function onScroll() {
  const el = feedRef.value
  if (!el) return
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight
  stickToBottom.value = distance < 80
  showJump.value = !stickToBottom.value
}

function scrollToBottom(smooth = true) {
  const el = feedRef.value
  if (!el) return
  el.scrollTo({
    top: el.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  })
  stickToBottom.value = true
  showJump.value = false
}

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    if (stickToBottom.value) {
      const reduce = import.meta.client
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      scrollToBottom(!reduce)
    }
    else {
      showJump.value = true
    }
  },
)

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

const statusOptions: { value: WhatsappFeedStatusFilter, label: string }[] = [
  { value: 'actionable', label: 'Actie nodig' },
  { value: 'new', label: 'Nieuw' },
  { value: 'flagged', label: 'Gemarkeerd' },
  { value: 'handled', label: 'Afgehandeld' },
  { value: 'all', label: 'Alles' },
]

const periodOptions: { value: WhatsappFeedPeriodFilter, label: string }[] = [
  { value: 'today', label: 'Vandaag' },
  { value: '24h', label: '24u' },
  { value: 'all', label: 'Alles' },
]
</script>

<template>
  <section class="ic-wa-feed" aria-label="WhatsApp-feed">
    <div class="ic-wa-feed__filters" role="toolbar" aria-label="Filters">
      <div class="ic-wa-feed__chips">
        <button
          v-for="opt in statusOptions"
          :key="opt.value"
          type="button"
          class="ic-wa-chip"
          :class="{ 'ic-wa-chip--active': statusFilter === opt.value }"
          @click="emit('update:statusFilter', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <div class="ic-wa-feed__chips">
        <button
          v-for="opt in periodOptions"
          :key="opt.value"
          type="button"
          class="ic-wa-chip ic-wa-chip--muted"
          :class="{ 'ic-wa-chip--active': periodFilter === opt.value }"
          @click="emit('update:periodFilter', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div
      ref="feedRef"
      class="ic-wa-feed__scroll"
      @scroll="onScroll"
    >
      <div v-if="loading && messages.length === 0" class="ic-wa-feed__skeletons">
        <div v-for="n in 4" :key="n" class="ic-wa-skeleton" />
      </div>

      <div
        v-else-if="connectionStatus !== 'connected'"
        class="ic-wa-feed__empty"
      >
        <i class="pi pi-whatsapp" aria-hidden="true" />
        <h3>WhatsApp nog niet gekoppeld</h3>
        <p v-if="isAdmin">
          Koppel het control room-nummer om groepsberichten live te volgen.
        </p>
        <p v-else>
          Alleen admins kunnen WhatsApp koppelen. Zodra een admin verbonden heeft,
          zie je hier de live feed.
        </p>
        <Button
          v-if="isAdmin"
          label="Nu verbinden"
          icon="pi pi-qrcode"
          @click="emit('openSetup')"
        />
      </div>

      <div
        v-else-if="!hasMonitoredGroups"
        class="ic-wa-feed__empty"
      >
        <i class="pi pi-comments" aria-hidden="true" />
        <h3>Kies kanalen om te volgen</h3>
        <p>Zet monitoring aan bij de groepen die belangrijk zijn voor vandaag.</p>
        <Button
          v-if="isAdmin"
          label="Instellingen openen"
          icon="pi pi-cog"
          severity="secondary"
          @click="emit('openSetup')"
        />
      </div>

      <div
        v-else-if="feedItems.length === 0"
        class="ic-wa-feed__empty"
      >
        <i class="pi pi-check-circle" aria-hidden="true" />
        <h3>Geen berichten</h3>
        <p>Geen berichten voor deze filter — alles rustig.</p>
      </div>

      <template v-else>
        <template v-for="item in feedItems" :key="item.key">
          <div v-if="item.kind === 'date'" class="ic-wa-feed__date">
            <span>{{ item.label }}</span>
          </div>
          <WhatsappMessageCard
            v-else
            :message="item.message"
            :selected="selectedMessageId === item.message.id"
            :expanded="expandedIds.has(item.message.id)"
            @select="emit('update:selectedMessageId', item.message.id)"
            @handled="emit('handled', item.message.id)"
            @flag="emit('flag', item.message.id)"
            @reply="emit('reply', item.message.id)"
            @link="emit('link', item.message.id)"
            @create="emit('create', item.message.id)"
            @toggle-expand="toggleExpand(item.message.id)"
          />
        </template>
      </template>
    </div>

    <button
      v-if="showJump"
      type="button"
      class="ic-wa-feed__jump"
      @click="scrollToBottom()"
    >
      Nieuwe berichten ↓
    </button>
  </section>
</template>
