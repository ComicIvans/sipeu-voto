<script setup lang="ts">
import { ADMIN_ROUTES } from '~~/shared/constants/routes'

definePageMeta({ layout: 'admin' })

interface AdminStats {
  users: number
  suspended: number
  committees: number
  groups: number
  votes: number
  openVotes: number
  openVoteList: Array<{
    id: string
    name: string
    committee: { name: string; slug: string } | null
  }>
}

const { data, refresh } = await useFetch<{ data: AdminStats }>('/api/admin/stats')
const stats = computed(() => data.value?.data)

useLiveRefresh(refresh)

const cards = computed(() => [
  {
    label: 'Usuarios',
    value: stats.value?.users ?? 0,
    icon: 'i-lucide-users',
    to: ADMIN_ROUTES.users,
  },
  {
    label: 'Suspendidos',
    value: stats.value?.suspended ?? 0,
    icon: 'i-lucide-user-x',
    to: ADMIN_ROUTES.users,
  },
  {
    label: 'Comisiones',
    value: stats.value?.committees ?? 0,
    icon: 'i-lucide-landmark',
    to: ADMIN_ROUTES.committees,
  },
  {
    label: 'Grupos',
    value: stats.value?.groups ?? 0,
    icon: 'i-lucide-flag',
    to: ADMIN_ROUTES.groups,
  },
  {
    label: 'Votaciones',
    value: stats.value?.votes ?? 0,
    icon: 'i-lucide-vote',
    to: ADMIN_ROUTES.votes,
  },
  {
    label: 'Abiertas ahora',
    value: stats.value?.openVotes ?? 0,
    icon: 'i-lucide-radio',
    to: ADMIN_ROUTES.votes,
  },
])

useHead({ title: 'Panel' })
</script>

<template>
  <div class="animate-fade-slide-up space-y-8">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="card in cards"
        :key="card.label"
        :to="card.to"
        class="motion-card border-default bg-default flex items-center gap-4 rounded-xl border p-5 shadow-sm"
      >
        <div
          class="bg-sipeu-50 text-sipeu-700 dark:bg-sipeu-900/50 dark:text-sipeu-200 flex size-11 items-center justify-center rounded-lg"
        >
          <UIcon :name="card.icon" class="size-5" />
        </div>
        <div>
          <p class="text-muted text-sm">{{ card.label }}</p>
          <p class="text-highlighted text-2xl font-bold tabular-nums">{{ card.value }}</p>
        </div>
      </NuxtLink>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">Votaciones abiertas</h2>
          <UButton
            :to="ADMIN_ROUTES.votes"
            size="sm"
            color="neutral"
            variant="ghost"
            trailing-icon="i-lucide-arrow-right"
          >
            Gestionar
          </UButton>
        </div>
      </template>
      <ul v-if="stats?.openVoteList.length" class="divide-default divide-y">
        <li v-for="vote in stats.openVoteList" :key="vote.id" class="flex items-center gap-3 py-2">
          <span class="relative flex size-2.5">
            <span
              class="animate-pulse-live absolute inline-flex size-full rounded-full bg-green-400 opacity-75"
            />
            <span class="relative inline-flex size-2.5 rounded-full bg-green-500" />
          </span>
          <span class="text-muted text-xs font-semibold uppercase">{{
            vote.committee?.name ?? 'Pleno'
          }}</span>
          <span class="min-w-0 flex-1 truncate font-medium">{{ vote.name }}</span>
          <UButton
            :to="`${ADMIN_ROUTES.votes}/${vote.id}`"
            size="xs"
            color="primary"
            variant="soft"
          >
            Ver en directo
          </UButton>
        </li>
      </ul>
      <p v-else class="text-muted text-sm">No hay ninguna votación abierta.</p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Acciones rápidas</h2>
      </template>
      <div class="flex flex-wrap gap-3">
        <UButton :to="`${ADMIN_ROUTES.votes}?nueva=1`" icon="i-lucide-plus" color="primary"
          >Nueva votación</UButton
        >
        <UButton
          :to="`${ADMIN_ROUTES.users}?importar=1`"
          icon="i-lucide-file-spreadsheet"
          color="neutral"
          variant="subtle"
        >
          Importar usuarios (CSV)
        </UButton>
        <UButton
          to="/"
          target="_blank"
          icon="i-lucide-external-link"
          color="neutral"
          variant="ghost"
        >
          Ver web pública
        </UButton>
      </div>
    </UCard>
  </div>
</template>
