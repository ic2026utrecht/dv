<script setup lang="ts">
import type { WhatsappGroup } from '~/types/models'

const props = defineProps<{
  groups: WhatsappGroup[]
  selectedGroupJid: string | null
  isAdmin: boolean
  activeOnly: boolean
  search: string
}>()

const emit = defineEmits<{
  'update:selectedGroupJid': [value: string | null]
  'update:activeOnly': [value: boolean]
  'update:search': [value: string]
  toggleMonitored: [groupJid: string, isMonitored: boolean]
  monitorActiveToday: []
  openSetup: []
}>()

const filtered = computed(() => {
  const q = props.search.trim().toLowerCase()
  if (!q) return props.groups
  return props.groups.filter(g => g.name.toLowerCase().includes(q) || g.groupJid.includes(q))
})

function selectGroup(jid: string | null) {
  emit('update:selectedGroupJid', jid)
}
</script>

<template>
  <aside class="ic-wa-sidebar" aria-label="WhatsApp-kanalen">
    <div class="ic-wa-sidebar__header">
      <h2 class="ic-wa-sidebar__title">
        Kanalen
      </h2>
      <Button
        v-if="isAdmin"
        icon="pi pi-cog"
        severity="secondary"
        text
        rounded
        aria-label="Instellingen"
        @click="emit('openSetup')"
      />
    </div>

    <div class="ic-wa-sidebar__search">
      <span class="p-input-icon-left w-full">
        <i class="pi pi-search" />
        <InputText
          :model-value="search"
          class="w-full"
          placeholder="Zoek groep…"
          @update:model-value="emit('update:search', String($event ?? ''))"
        />
      </span>
    </div>

    <div class="ic-wa-sidebar__filters">
      <div class="ic-wa-sidebar__toggle-row">
        <label for="wa-active-only">Alleen actieve vandaag</label>
        <ToggleSwitch
          input-id="wa-active-only"
          :model-value="activeOnly"
          @update:model-value="emit('update:activeOnly', Boolean($event))"
        />
      </div>
      <Button
        v-if="isAdmin"
        label="Monitor actieve vandaag"
        size="small"
        severity="secondary"
        text
        class="ic-wa-sidebar__bulk"
        @click="emit('monitorActiveToday')"
      />
    </div>

    <button
      type="button"
      class="ic-wa-sidebar__item"
      :class="{ 'ic-wa-sidebar__item--active': selectedGroupJid === null }"
      @click="selectGroup(null)"
    >
      <span class="ic-wa-sidebar__item-name">Alle kanalen</span>
    </button>

    <ul class="ic-wa-sidebar__list">
      <li
        v-for="group in filtered"
        :key="group.groupJid"
      >
        <button
          type="button"
          class="ic-wa-sidebar__item"
          :class="{
            'ic-wa-sidebar__item--active': selectedGroupJid === group.groupJid,
            'ic-wa-sidebar__item--muted': !group.isMonitored,
          }"
          @click="selectGroup(group.groupJid)"
        >
          <span class="ic-wa-sidebar__item-main">
            <span class="ic-wa-sidebar__item-name">{{ group.name || group.groupJid }}</span>
            <span
              v-if="group.unreadCount > 0"
              class="ic-wa-sidebar__badge"
              :aria-label="`${group.unreadCount} nieuw`"
            >
              {{ group.unreadCount > 99 ? '99+' : group.unreadCount }}
            </span>
          </span>
          <span
            v-if="isAdmin"
            class="ic-wa-sidebar__item-toggle"
            @click.stop
          >
            <ToggleSwitch
              :model-value="group.isMonitored"
              :aria-label="`Monitor ${group.name}`"
              @update:model-value="emit('toggleMonitored', group.groupJid, Boolean($event))"
            />
          </span>
        </button>
      </li>
    </ul>

    <p
      v-if="filtered.length === 0"
      class="ic-wa-sidebar__empty"
    >
      Geen groepen gevonden. Sync eerst via Instellingen.
    </p>
  </aside>
</template>
