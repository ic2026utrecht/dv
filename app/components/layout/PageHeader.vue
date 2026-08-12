<script setup lang="ts">
import ic2026Logo from '~/assets/images/ic2026-co-logo.svg'

defineProps<{
  title?: string
  subtitle?: string
  step?: number
}>()

const route = useRoute()
const { isLoggedIn, isAdmin, displayName, fetchMe, logout } = useStaffAuth()

const showStaffNav = computed(() => {
  const path = route.path
  return path.startsWith('/sitrep')
    || path.startsWith('/profile')
    || path.startsWith('/admin')
})

onMounted(() => {
  if (isLoggedIn.value) {
    fetchMe().catch(() => {})
  }
})

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) fetchMe().catch(() => {})
})

async function onLogout() {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <header class="ic-header-hero">
    <div class="ic-header-brand">
      <img
        :src="ic2026Logo"
        alt="IC2026 Congres Nederland"
        class="ic-header-logo"
        width="72"
        height="88"
      >
      <div class="ic-header-copy">
        <p class="ic-header-kicker">
          IC2026 DV · Live registratie
        </p>
        <h1 class="ic-header-title">
          {{ title ?? 'Incident melden' }}
        </h1>
        <p v-if="subtitle" class="ic-header-sub">
          {{ subtitle }}
        </p>
        <div v-if="step" class="ic-header-step">
          <span class="ic-step-badge">{{ step }}</span>
          Vul alle verplichte velden in
        </div>
      </div>
    </div>

    <nav
      v-if="showStaffNav && isLoggedIn"
      class="ic-header-nav"
      aria-label="Account"
    >
      <span v-if="displayName" class="ic-header-nav__name">
        {{ displayName }}
      </span>
      <NuxtLink
        to="/sitrep"
        class="ic-header-nav__link"
      >
        Sitrep
      </NuxtLink>
      <NuxtLink
        v-if="isAdmin"
        to="/admin"
        class="ic-header-nav__link"
      >
        Medewerkers
      </NuxtLink>
      <NuxtLink
        to="/profile"
        class="ic-header-nav__link"
      >
        Profiel
      </NuxtLink>
      <button
        type="button"
        class="ic-header-nav__link ic-header-nav__button"
        @click="onLogout"
      >
        Uitloggen
      </button>
    </nav>
  </header>
</template>
