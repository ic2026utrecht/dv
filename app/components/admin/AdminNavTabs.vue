<script setup lang="ts">
const route = useRoute()

const tabs = [
  { to: '/admin/users', label: 'Medewerkers', icon: 'pi-users' },
  { to: '/admin/locations', label: 'Locaties', icon: 'pi-map-marker' },
  { to: '/admin/incident-types', label: 'Incidenttypes', icon: 'pi-list' },
  { to: '/admin/export', label: 'Export', icon: 'pi-download' },
] as const

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <nav class="ic-admin-tabs" aria-label="Admin secties">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="ic-admin-tabs__link"
      :class="{ 'ic-admin-tabs__link--active': isActive(tab.to) }"
    >
      <i :class="['pi', tab.icon]" aria-hidden="true" />
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.ic-admin-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  padding: 0 1.25rem;
  border-bottom: 1px solid rgb(135 161 198 / 0.35);
  background: rgb(255 255 255 / 0.55);
}

.ic-admin-tabs__link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: -1px;
  padding: 0.75rem 0.875rem;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.ic-admin-tabs__link:hover,
.ic-admin-tabs__link:focus-visible {
  color: var(--ic-brand-dark);
  outline: none;
}

.ic-admin-tabs__link--active {
  border-bottom-color: var(--ic-orange);
  color: var(--ic-brand-dark);
}

@media (min-width: 640px) {
  .ic-admin-tabs {
    padding-inline: 1.5rem;
  }
}
</style>
