<script setup lang="ts">
import { ADMIN_ROUTES, USER_ROUTES } from '~~/shared/constants/routes'

const { user, isAdmin, signOut } = useAuth()
const route = useRoute()

const links = computed(() => {
  const items = [{ label: 'Comisiones', to: '/', icon: 'i-lucide-landmark', exact: true }]
  if (user.value) {
    items.push({ label: 'Votar', to: USER_ROUTES.vote, icon: 'i-lucide-vote', exact: false })
    items.push({
      label: 'Perfil',
      to: USER_ROUTES.profile,
      icon: 'i-lucide-user-round',
      exact: false,
    })
  }
  if (isAdmin.value) {
    items.push({
      label: 'Admin',
      to: ADMIN_ROUTES.dashboard,
      icon: 'i-lucide-shield',
      exact: false,
    })
  }
  return items
})

function isActive(link: { to: string; exact: boolean }) {
  return link.exact ? route.path === link.to : route.path.startsWith(link.to)
}
</script>

<template>
  <header class="bg-sipeu-700 dark:bg-sipeu-900 sticky top-0 z-40 text-white shadow-md">
    <div class="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
      <NuxtLink
        to="/"
        class="flex shrink-0 items-center gap-3 rounded-sm focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
        aria-label="Votaciones SIPEU, inicio"
      >
        <img src="/brand/sipeu-white.png" alt="" class="h-10 w-auto" />
        <span class="hidden text-sm leading-tight font-semibold sm:block">
          Votaciones
          <span class="block text-xs font-normal text-white/75">SIPEU Canarias</span>
        </span>
      </NuxtLink>

      <nav class="ml-2 flex items-center gap-1 sm:ml-6" aria-label="Navegación principal">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none sm:px-2.5 sm:py-1.5"
          :class="isActive(link) ? 'bg-white/15 text-white' : 'text-white/80'"
          :aria-current="isActive(link) ? 'page' : undefined"
          :aria-label="link.label"
          :title="link.label"
        >
          <UIcon :name="link.icon" class="size-4" />
          <span class="hidden sm:inline">{{ link.label }}</span>
        </NuxtLink>
      </nav>

      <div class="flex-1" />

      <ThemeToggle inverted />

      <template v-if="user">
        <UDropdownMenu
          :items="[
            [{ label: user.name, type: 'label' }],
            [
              { label: 'Mi perfil', icon: 'i-lucide-user-round', to: USER_ROUTES.profile },
              { label: 'Cerrar sesión', icon: 'i-lucide-log-out', onSelect: () => signOut() },
            ],
          ]"
        >
          <button
            type="button"
            class="flex items-center gap-2 rounded-full focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
            aria-label="Menú de usuario"
          >
            <UserAvatar :user="user" size="sm" class="ring-2 ring-white/40" />
          </button>
        </UDropdownMenu>
      </template>
      <UButton
        v-else
        :to="USER_ROUTES.login"
        color="neutral"
        variant="solid"
        size="sm"
        icon="i-lucide-log-in"
        class="text-sipeu-800 bg-white hover:bg-white/90"
      >
        Acceder
      </UButton>
    </div>
  </header>
</template>
