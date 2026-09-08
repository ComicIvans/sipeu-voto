<script setup lang="ts">
import type { AdminCommittee, VoteSummary } from '~~/shared/types/api'
import { ADMIN_ROUTES } from '~~/shared/constants/routes'
import { AdminVoteFormModal, ConfirmModal } from '#components'

definePageMeta({ layout: 'admin' })

const toast = useApiToast()
const overlay = useOverlay()
const route = useRoute()
const { formatDateTime } = useFormatting()

const voteFormModal = overlay.create(AdminVoteFormModal)
const confirmModal = overlay.create(ConfirmModal)

const { data: votesData, refresh } = await useFetch<{ data: VoteSummary[] }>('/api/admin/votes')
const { data: committeesData } = await useFetch<{ data: AdminCommittee[] }>('/api/admin/committees')

const votes = computed(() => votesData.value?.data ?? [])
const committees = computed(() => committeesData.value?.data ?? [])

useLiveRefresh(refresh)

const scopeFilter = ref<string>('all')
const scopeItems = computed(() => [
  { label: 'Todas', value: 'all' },
  { label: 'Pleno', value: 'plenary' },
  ...committees.value.map((committee) => ({ label: committee.name, value: committee.id })),
])

const filteredVotes = computed(() =>
  votes.value.filter((vote) => {
    if (scopeFilter.value === 'all') return true
    if (scopeFilter.value === 'plenary') return vote.committeeId === null
    return vote.committeeId === scopeFilter.value
  })
)

const busyId = ref<string | null>(null)

async function createVote() {
  const defaultCommitteeId =
    scopeFilter.value !== 'all' && scopeFilter.value !== 'plenary' ? scopeFilter.value : null
  const result = await voteFormModal.open({
    vote: null,
    committees: committees.value,
    defaultCommitteeId,
  }).result
  if (result.saved && result.id) await navigateTo(`${ADMIN_ROUTES.votes}/${result.id}`)
}

async function editVote(vote: VoteSummary) {
  const result = await voteFormModal.open({ vote, committees: committees.value }).result
  if (result.saved) await refresh()
}

async function toggleOpen(vote: VoteSummary) {
  if (vote.open) {
    const confirmed = await confirmModal.open({
      title: `Cerrar "${vote.name}"`,
      description: 'Nadie más podrá votar. Podrás reabrirla conservando los votos ya emitidos.',
      confirmLabel: 'Cerrar votación',
      color: 'error',
    }).result
    if (!confirmed) return
  }
  busyId.value = vote.id
  try {
    await $fetch(`/api/admin/votes/${vote.id}/${vote.open ? 'close' : 'open'}`, { method: 'POST' })
    toast.success(vote.open ? 'Votación cerrada' : 'Votación abierta')
    await refresh()
  } catch (error) {
    toast.error(error)
  } finally {
    busyId.value = null
  }
}

async function duplicateVote(vote: VoteSummary) {
  try {
    const response = await $fetch<{ data: { id: string } }>(
      `/api/admin/votes/${vote.id}/duplicate`,
      {
        method: 'POST',
      }
    )
    toast.success('Votación duplicada', 'Copia pendiente sin votos.')
    await navigateTo(`${ADMIN_ROUTES.votes}/${response.data.id}`)
  } catch (error) {
    toast.error(error)
  }
}

async function removeVote(vote: VoteSummary) {
  const confirmed = await confirmModal.open({
    title: `Eliminar "${vote.name}"`,
    description: 'Se borrarán sus opciones y todos los votos emitidos.',
    confirmLabel: 'Eliminar',
  }).result
  if (!confirmed) return
  try {
    await $fetch(`/api/admin/votes/${vote.id}`, { method: 'DELETE' })
    toast.success('Votación eliminada')
    await refresh()
  } catch (error) {
    toast.error(error)
  }
}

onMounted(() => {
  if (route.query.nueva) void createVote()
})

useHead({ title: 'Votaciones' })
</script>

<template>
  <div class="animate-fade-slide-up space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <USelect v-model="scopeFilter" :items="scopeItems" class="w-48" />
        <p class="text-muted text-sm">{{ filteredVotes.length }} votaciones</p>
      </div>
      <UButton icon="i-lucide-plus" color="primary" @click="createVote">Nueva votación</UButton>
    </div>

    <div
      v-if="filteredVotes.length === 0"
      class="border-default text-muted rounded-xl border border-dashed py-16 text-center"
    >
      <UIcon name="i-lucide-vote" class="mx-auto size-10" />
      <p class="mt-3">No hay votaciones. Crea la primera.</p>
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="vote in filteredVotes"
        :key="vote.id"
        class="border-default bg-default rounded-xl border p-4 shadow-sm"
        :class="vote.open ? 'ring-1 ring-green-500/40' : ''"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge color="neutral" variant="subtle" size="sm">{{
                vote.committee?.name ?? 'Pleno'
              }}</UBadge>
              <VoteStatus :status="vote.status" size="sm" />
              <UBadge
                v-if="vote.locked && !vote.open"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-lock"
                >Con votos</UBadge
              >
              <UBadge
                v-if="!vote.visible"
                color="warning"
                variant="subtle"
                size="sm"
                icon="i-lucide-eye-off"
                >Oculta</UBadge
              >
              <UBadge
                v-if="!vote.showLiveResults"
                color="info"
                variant="subtle"
                size="sm"
                icon="i-lucide-eye-off"
                >Resultado al cerrar</UBadge
              >
              <UBadge
                v-if="vote.allowChange"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-refresh-cw"
                >Cambio permitido</UBadge
              >
            </div>
            <NuxtLink
              :to="`${ADMIN_ROUTES.votes}/${vote.id}`"
              class="text-highlighted hover:text-primary mt-2 block text-lg font-semibold"
            >
              {{ vote.name }}
            </NuxtLink>
            <p class="text-muted text-xs">
              {{ vote.options.length }} opciones ·
              <template v-if="vote.open && vote.startedAt"
                >abierta desde {{ formatDateTime(vote.startedAt) }}</template
              >
              <template v-else-if="vote.endedAt"
                >cerrada {{ formatDateTime(vote.endedAt) }}</template
              >
              <template v-else>sin abrir</template>
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              :color="vote.open ? 'error' : 'success'"
              :icon="vote.open ? 'i-lucide-square' : 'i-lucide-play'"
              :loading="busyId === vote.id"
              size="sm"
              @click="toggleOpen(vote)"
            >
              {{ vote.open ? 'Cerrar' : vote.status === 'closed' ? 'Reabrir' : 'Abrir' }}
            </UButton>
            <UButton
              :to="`${ADMIN_ROUTES.votes}/${vote.id}`"
              icon="i-lucide-bar-chart-3"
              color="primary"
              variant="soft"
              size="sm"
            >
              Resultados
            </UButton>
            <UDropdownMenu
              :items="[
                [
                  { label: 'Editar', icon: 'i-lucide-pencil', onSelect: () => editVote(vote) },
                  {
                    label: 'Duplicar (repetir sin votos)',
                    icon: 'i-lucide-copy',
                    onSelect: () => duplicateVote(vote),
                  },
                  {
                    label: 'Exportar CSV',
                    icon: 'i-lucide-download',
                    to: `/api/admin/votes/${vote.id}/export`,
                    external: true,
                  },
                  {
                    label: 'Ver pública',
                    icon: 'i-lucide-external-link',
                    to: `/v/${vote.id}`,
                    target: '_blank',
                  },
                ],
                [
                  {
                    label: 'Eliminar',
                    icon: 'i-lucide-trash-2',
                    color: 'error',
                    onSelect: () => removeVote(vote),
                  },
                ],
              ]"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                size="sm"
                aria-label="Más acciones"
              />
            </UDropdownMenu>
          </div>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <VoteParticipation
            :voted="vote.participation.voted"
            :eligible="vote.participation.eligible"
            compact
          />
          <div
            v-if="vote.participation.voted > 0"
            class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
          >
            <UBadge
              v-if="vote.status === 'closed' && vote.tie"
              color="neutral"
              variant="subtle"
              size="sm"
              icon="i-lucide-scale"
              >Empate</UBadge
            >
            <span
              v-for="total in vote.totals"
              :key="total.optionId"
              class="inline-flex items-center gap-1"
            >
              <span class="text-muted">{{
                vote.options.find((o) => o.id === total.optionId)?.label
              }}</span>
              <span class="font-mono font-semibold">{{ total.count }}</span>
              <UIcon
                v-if="vote.winnerIds.includes(total.optionId)"
                name="i-lucide-trophy"
                class="text-eu-500 size-3"
              />
            </span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
