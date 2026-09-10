<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { ADMIN_ROUTES } from '~~/shared/constants/routes'

const { user, signOut } = useAuth()
const route = useRoute()

const items = computed<NavigationMenuItem[][]>(() => [
  [
    { label: 'Panel', icon: 'i-lucide-layout-dashboard', to: ADMIN_ROUTES.dashboard, exact: true },
    { label: 'Votaciones', icon: 'i-lucide-vote', to: ADMIN_ROUTES.votes },
    { label: 'Usuarios', icon: 'i-lucide-users', to: ADMIN_ROUTES.users },
    { label: 'Comisiones', icon: 'i-lucide-landmark', to: ADMIN_ROUTES.committees },
    { label: 'Grupos parlamentarios', icon: 'i-lucide-flag', to: ADMIN_ROUTES.groups },
  ],
  [
    { label: 'Ver web pública', icon: 'i-lucide-globe', to: '/' },
    { label: 'Mi perfil', icon: 'i-lucide-user-round', to: '/perfil' },
  ],
])

const currentTitle = computed(() => {
  const flat = items.value.flat()
  const match = flat.find((item) =>
    item.exact
      ? route.path === item.to
      : typeof item.to === 'string' && route.path.startsWith(item.to)
  )
  return match?.label ?? 'Administración'
})

useHead({
  titleTemplate: (titleChunk) =>
    titleChunk ? `${titleChunk} | Admin SIPEU` : 'Administración | Votaciones SIPEU',
})
</script>

<template>
  <UDashboardGroup storage-key="sipeu-admin">
    <UDashboardSidebar
      collapsible
      resizable
      :min-size="14"
      :default-size="18"
      class="bg-elevated/40"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/admin" class="flex items-center gap-2 overflow-hidden">
          <img src="/brand/sipeu-mark.png" alt="" class="size-8 shrink-0" />
          <span v-if="!collapsed" class="text-highlighted truncate text-sm font-bold">
            Admin SIPEU
          </span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu :collapsed="collapsed" :items="items[0]" orientation="vertical" />
        <UNavigationMenu
          :collapsed="collapsed"
          :items="items[1]"
          orientation="vertical"
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex w-full items-center gap-2 overflow-hidden">
          <UserAvatar :user="user" size="sm" />
          <div v-if="!collapsed" class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ user?.name }}</p>
            <p class="text-muted truncate text-xs">{{ user?.email }}</p>
          </div>
          <UTooltip text="Cerrar sesión">
            <UButton
              icon="i-lucide-log-out"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Cerrar sesión"
              @click="signOut"
            />
          </UTooltip>
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar :title="currentTitle">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <ThemeToggle />
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
