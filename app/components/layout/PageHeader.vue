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
    || path.startsWith('/whatsapp')
})

const { unreadTotal } = useWhatsappFeed()

const mobileNavOpen = ref(false)

type StaffNavLink = {
  to: string
  label: string
  badge?: number
}

const staffNavLinks = computed((): StaffNavLink[] => {
  const links: StaffNavLink[] = [
    { to: '/sitrep', label: 'Sitrep' },
    // { to: '/whatsapp', label: 'WhatsApp', badge: unreadTotal.value },
    { to: '/profile', label: 'Profiel' },
  ]

  if (isAdmin.value) {
    links.push({ to: '/admin', label: 'Users' })
  }

  return links
})

onMounted(() => {
  if (showStaffNav.value) {
    fetchMe().catch(() => {})
  }
})

watch(showStaffNav, (visible) => {
  if (visible) fetchMe().catch(() => {})
})

watch(() => route.path, () => {
  mobileNavOpen.value = false
})

async function onLogout() {
  mobileNavOpen.value = false
  await logout()
  await navigateTo('/login')
}

function isActive(prefix: string): boolean {
  return route.path.startsWith(prefix)
}

function navLinkClass(prefix: string) {
  return { 'ic-staff-nav__link--active': isActive(prefix) }
}

function onNavClick() {
  mobileNavOpen.value = false
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

      <div
        v-if="showStaffNav"
        class="ic-staff-nav-wrap"
      >
        <nav
          class="ic-staff-nav ic-staff-nav--desktop"
          aria-label="Account navigatie"
        >
          <span
            v-if="displayName"
            class="ic-staff-nav__name"
          >
            {{ displayName }}
          </span>
          <NuxtLink
            v-for="link in staffNavLinks"
            :key="link.to"
            :to="link.to"
            class="ic-staff-nav__link"
            :class="navLinkClass(link.to)"
          >
            {{ link.label }}
            <span
              v-if="link.badge && link.badge > 0"
              class="ic-wa-nav-badge"
              :aria-label="`${link.badge} nieuwe berichten`"
            >
              {{ link.badge > 99 ? '99+' : link.badge }}
            </span>
          </NuxtLink>
          <button
            type="button"
            class="ic-staff-nav__link ic-staff-nav__button"
            @click="onLogout"
          >
            Uitloggen
          </button>
        </nav>

        <button
          type="button"
          class="ic-staff-nav__menu-btn"
          :aria-expanded="mobileNavOpen"
          aria-controls="ic-staff-nav-mobile"
          aria-label="Menu openen"
          @click="mobileNavOpen = true"
        >
          <i class="pi pi-bars" aria-hidden="true" />
        </button>

        <Drawer
          v-model:visible="mobileNavOpen"
          position="right"
          header="Menu"
          class="ic-staff-nav-drawer"
          :style="{ width: 'min(100vw, 17rem)' }"
          :block-scroll="true"
          :dismissable-mask="true"
        >
          <nav
            id="ic-staff-nav-mobile"
            class="ic-staff-nav-mobile"
            aria-label="Account navigatie"
          >
            <p
              v-if="displayName"
              class="ic-staff-nav-mobile__name"
            >
              {{ displayName }}
            </p>

            <NuxtLink
              v-for="link in staffNavLinks"
              :key="link.to"
              :to="link.to"
              class="ic-staff-nav-mobile__link"
              :class="{ 'ic-staff-nav-mobile__link--active': isActive(link.to) }"
              @click="onNavClick"
            >
              <span>{{ link.label }}</span>
              <span
                v-if="link.badge && link.badge > 0"
                class="ic-wa-nav-badge"
                :aria-label="`${link.badge} nieuwe berichten`"
              >
                {{ link.badge > 99 ? '99+' : link.badge }}
              </span>
              <i class="pi pi-chevron-right" aria-hidden="true" />
            </NuxtLink>

            <button
              type="button"
              class="ic-staff-nav-mobile__link ic-staff-nav-mobile__link--logout"
              @click="onLogout"
            >
              <span>Uitloggen</span>
              <i class="pi pi-sign-out" aria-hidden="true" />
            </button>
          </nav>
        </Drawer>
      </div>
    </div>
  </header>
</template>

<style scoped>
.ic-staff-nav-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.ic-staff-nav--desktop {
  display: none;
}

.ic-staff-nav__menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  margin: 0;
  padding: 0;
  border: 1px solid rgb(45 46 126 / 0.18);
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 0.65);
  color: var(--ic-brand-dark);
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ic-staff-nav__menu-btn:hover,
.ic-staff-nav__menu-btn:focus-visible {
  background: #fff;
  border-color: rgb(45 46 126 / 0.3);
  outline: none;
}

.ic-staff-nav-mobile {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.ic-staff-nav-mobile__name {
  margin: 0 0 0.5rem;
  padding: 0 0.25rem 0.75rem;
  border-bottom: 1px solid rgb(135 161 198 / 0.25);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ic-brand-dark);
}

.ic-staff-nav-mobile__link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 0.875rem;
  border: 1px solid rgb(135 161 198 / 0.2);
  border-radius: 0.625rem;
  background: #fff;
  color: var(--ic-brand-dark);
  font-size: 0.9375rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ic-staff-nav-mobile__link span:first-child {
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
}

.ic-staff-nav-mobile__link .pi-chevron-right,
.ic-staff-nav-mobile__link .pi-sign-out {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: #94a3b8;
}

.ic-staff-nav-mobile__link:hover,
.ic-staff-nav-mobile__link:focus-visible {
  background: rgb(45 46 126 / 0.04);
  border-color: rgb(135 161 198 / 0.35);
  outline: none;
}

.ic-staff-nav-mobile__link--active {
  border-color: rgb(230 151 50 / 0.55);
  background: rgb(230 151 50 / 0.08);
  font-weight: 700;
}

.ic-staff-nav-mobile__link--logout {
  margin-top: 0.5rem;
  border-color: rgb(186 49 72 / 0.25);
  color: var(--ic-crimson);
}

.ic-staff-nav-mobile__link--logout .pi-sign-out {
  color: var(--ic-crimson);
}

@media (min-width: 640px) {
  .ic-staff-nav--desktop {
    display: flex;
  }

  .ic-staff-nav__menu-btn {
    display: none;
  }
}
</style>
