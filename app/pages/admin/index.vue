<script setup lang="ts">
import { ADMIN_ROUTES } from '~~/shared/constants/routes'
import type { VoteStatus } from '~~/shared/utils/voteStatus'

definePageMeta({ layout: 'admin' })

interface VoteCheck {
  id: string
  name: string
  committee: { name: string; slug: string } | null
  status: VoteStatus
  options: number
  winnable: number
  allowChange: boolean
  showLiveResults: boolean
  visible: boolean
  minimumVotes: number | null
  maxWinners: number | null
}

interface AdminStats {
  users: number
  suspended: number
  committees: number
  groups: number
  votes: number
  openVotes: number
  openVoteList: VoteCheck[]
  pendingVoteList: VoteCheck[]
  incompleteDelegates: Array<{
    id: string
    name: string
    email: string
    committeeId: string | null
    groupId: string | null
  }>
  votesWithoutOptions: VoteCheck[]
  votesWithoutWinnable: VoteCheck[]
}

const { data, refresh, error, status } = await useFetch<{ data: AdminStats }>('/api/admin/stats')
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

const warnings = computed(() => {
  const list: Array<{ key: string; text: string; to: string; count: number }> = []
  const s = stats.value
  if (!s) return list
  if (s.incompleteDelegates.length > 0) {
    list.push({
      key: 'incomplete',
      count: s.incompleteDelegates.length,
      text: 'participantes sin comisión o sin grupo (no podrán votar o votarán sin grupo)',
      to: `${ADMIN_ROUTES.users}?filtro=incompletos`,
    })
  }
  if (s.votesWithoutOptions.length > 0) {
    list.push({
      key: 'no-options',
      count: s.votesWithoutOptions.length,
      text: 'votaciones sin opciones de voto',
      to: ADMIN_ROUTES.votes,
    })
  }
  if (s.votesWithoutWinnable.length > 0) {
    list.push({
      key: 'no-winnable',
      count: s.votesWithoutWinnable.length,
      text: 'votaciones sin ninguna opción que pueda ganar',
      to: ADMIN_ROUTES.votes,
    })
  }
  if (s.suspended > 0) {
    list.push({
      key: 'suspended',
      count: s.suspended,
      text: 'cuentas suspendidas',
      to: ADMIN_ROUTES.users,
    })
  }
  return list
})

function describeRules(vote: VoteCheck) {
  const parts: string[] = []
  parts.push(vote.allowChange ? 'cambio de voto permitido' : 'sin cambio de voto')
  parts.push(vote.showLiveResults ? 'recuento en directo' : 'resultado al cerrar')
  if (vote.minimumVotes) parts.push(`mínimo ${vote.minimumVotes}`)
  if (vote.maxWinners) parts.push(`máx. ${vote.maxWinners} ganadoras`)
  if (!vote.visible) parts.push('oculta')
  return parts.join(' · ')
}

useHead({ title: 'Panel' })
</script>

<template>
  <div class="space-y-8">
    <DataError v-if="error && !data" :retrying="status === 'pending'" @retry="refresh" />

    <template v-else>
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
          <h2 class="flex items-center gap-2 font-semibold">
            <UIcon name="i-lucide-clipboard-check" class="text-primary size-5" />
            Comprobación previa
          </h2>
        </template>
        <ul v-if="warnings.length > 0" class="space-y-2">
          <li
            v-for="warning in warnings"
            :key="warning.key"
            class="flex items-center gap-3 text-sm"
          >
            <UIcon name="i-lucide-alert-triangle" class="size-4 shrink-0 text-amber-500" />
            <span class="flex-1">
              <span class="text-highlighted font-semibold">{{ warning.count }}</span>
              {{ warning.text }}
            </span>
            <UButton :to="warning.to" size="xs" color="neutral" variant="subtle">Revisar</UButton>
          </li>
        </ul>
        <p v-else class="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <UIcon name="i-lucide-check-circle-2" class="size-4" />
          Todo listo: participantes completos y votaciones configuradas.
        </p>
      </UCard>

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
          <li
            v-for="vote in stats.openVoteList"
            :key="vote.id"
            class="flex flex-wrap items-center gap-3 py-2"
          >
            <span class="relative flex size-2.5">
              <span
                class="animate-pulse-live absolute inline-flex size-full rounded-full bg-green-400 opacity-75"
              />
              <span class="relative inline-flex size-2.5 rounded-full bg-green-500" />
            </span>
            <span class="text-muted text-xs font-semibold uppercase">{{
              vote.committee?.name ?? 'Pleno'
            }}</span>
            <span class="w-full min-w-0 truncate font-medium sm:w-auto sm:flex-1">{{
              vote.name
            }}</span>
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

      <UCard v-if="stats?.pendingVoteList.length">
        <template #header>
          <h2 class="font-semibold">Próximas votaciones (pendientes de abrir)</h2>
        </template>
        <ul class="divide-default divide-y">
          <li
            v-for="vote in stats.pendingVoteList"
            :key="vote.id"
            class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
          >
            <span class="text-muted text-xs font-semibold uppercase">{{
              vote.committee?.name ?? 'Pleno'
            }}</span>
            <NuxtLink
              :to="`${ADMIN_ROUTES.votes}/${vote.id}`"
              class="text-highlighted hover:text-primary min-w-0 flex-1 truncate font-medium"
            >
              {{ vote.name }}
            </NuxtLink>
            <span class="text-muted w-full text-xs sm:w-auto">
              {{ vote.options }} opciones · {{ describeRules(vote) }}
            </span>
          </li>
        </ul>
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
          <UButton to="/" icon="i-lucide-globe" color="neutral" variant="ghost">
            Ver web pública
          </UButton>
        </div>
      </UCard>
    </template>
  </div>
</template>
