<script setup lang="ts">
import ic2026Logo from '~/assets/images/ic2026-co-logo.svg'

defineProps<{
  title?: string
  subtitle?: string
  step?: number
}>()

const route = useRoute()
const { isAdmin, displayName, fetchMe, logout } = useStaffAuth()

const showStaffNav = computed(() => {
  const path = route.path
  return path.startsWith('/sitrep')
    || path.startsWith('/profile')
    || path.startsWith('/admin')
})

onMounted(() => {
  if (showStaffNav.value) {
    fetchMe().catch(() => {})
  }
})

watch(showStaffNav, (visible) => {
  if (visible) fetchMe().catch(() => {})
})

async function onLogout() {
  await logout()
  await navigateTo('/login')
}

function isActive(prefix: string): boolean {
  return route.path.startsWith(prefix)
}
</script>

<template>
  <header class="ic-header-hero ic-header-hero--compact">
    <div class="ic-header-top">
      <div class="ic-header-brand">
        <img
          :src="ic2026Logo"
          alt="IC2026 Congres Nederland"
          class="ic-header-logo"
          width="40"
          height="49"
        >
        <div
          v-if="!showStaffNav || step"
          class="ic-header-copy"
        >
          <p
            v-if="!showStaffNav"
            class="ic-header-kicker"
          >
            IC2026 DV · Live registratie
          </p>
          <div v-if="step" class="ic-header-step">
            <span class="ic-step-badge">{{ step }}</span>
            Vul alle verplichte velden in
          </div>
        </div>
      </div>

      <nav
        v-if="showStaffNav"
        class="ic-staff-nav"
        aria-label="Account navigatie"
      >
        <span
          v-if="displayName"
          class="ic-staff-nav__name"
        >
          {{ displayName }}
        </span>
        <NuxtLink
          to="/sitrep"
          class="ic-staff-nav__link"
          :class="{ 'ic-staff-nav__link--active': isActive('/sitrep') }"
        >
          Sitrep
        </NuxtLink>
        <NuxtLink
          to="/profile"
          class="ic-staff-nav__link"
          :class="{ 'ic-staff-nav__link--active': isActive('/profile') }"
        >
          Profiel
        </NuxtLink>
        <NuxtLink
          v-if="isAdmin"
          to="/admin"
          class="ic-staff-nav__link"
          :class="{ 'ic-staff-nav__link--active': isActive('/admin') }"
        >
          Users
        </NuxtLink>
        <button
          type="button"
          class="ic-staff-nav__link ic-staff-nav__button"
          @click="onLogout"
        >
          Uitloggen
        </button>
      </nav>
    </div>
  </header>
</template>
