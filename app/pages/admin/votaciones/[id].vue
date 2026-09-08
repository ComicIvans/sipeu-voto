<script setup lang="ts">
import type { AdminCommittee, VoteWithResults } from '~~/shared/types/api'
import { ADMIN_ROUTES } from '~~/shared/constants/routes'
import { AdminVoteFormModal, ConfirmModal } from '#components'
import type { EditableOption } from '~/components/admin/VoteOptionsEditor.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const voteId = route.params.id as string
const toast = useApiToast()
const overlay = useOverlay()
const { formatDateTime } = useFormatting()

const voteFormModal = overlay.create(AdminVoteFormModal)
const confirmModal = overlay.create(ConfirmModal)

const { data, error, refresh } = await useFetch<{ data: VoteWithResults }>(
  `/api/admin/votes/${voteId}`
)
const { data: committeesData } = await useFetch<{ data: AdminCommittee[] }>('/api/admin/committees')

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Votación no encontrada', fatal: true })
}

const vote = computed(() => data.value!.data)
const committees = computed(() => committeesData.value?.data ?? [])

const { isConnected } = useLiveRefresh(refresh, (event) =>
  event.type === 'vote-changed' ? event.voteId === voteId : true
)

const isBusy = ref(false)

async function toggleOpen() {
  isBusy.value = true
  try {
    await $fetch(`/api/admin/votes/${voteId}/${vote.value.open ? 'close' : 'open'}`, {
      method: 'POST',
    })
    toast.success(vote.value.open ? 'Votación cerrada' : 'Votación abierta')
    await refresh()
  } catch (err) {
    toast.error(err)
  } finally {
    isBusy.value = false
  }
}

async function editVote() {
  const result = await voteFormModal.open({ vote: vote.value, committees: committees.value }).result
  if (result.saved) await refresh()
}

async function resetBallots() {
  const confirmed = await confirmModal.open({
    title: 'Borrar todos los votos',
    description:
      'Se eliminarán los votos emitidos y la votación quedará cerrada, lista para abrirse de nuevo.',
    confirmLabel: 'Borrar votos',
  }).result
  if (!confirmed) return
  try {
    await $fetch(`/api/admin/votes/${voteId}/reset`, { method: 'POST' })
    toast.success('Votos borrados')
    await refresh()
  } catch (err) {
    toast.error(err)
  }
}

async function removeVote() {
  const confirmed = await confirmModal.open({
    title: `Eliminar "${vote.value.name}"`,
    description: 'Se borrarán sus opciones y todos los votos emitidos.',
    confirmLabel: 'Eliminar',
  }).result
  if (!confirmed) return
  try {
    await $fetch(`/api/admin/votes/${voteId}`, { method: 'DELETE' })
    toast.success('Votación eliminada')
    await navigateTo(ADMIN_ROUTES.votes)
  } catch (err) {
    toast.error(err)
  }
}

// ─── Options editing (only while closed) ─────────────────────────────────────
const editingOptions = ref(false)
const draftOptions = ref<EditableOption[]>([])
const isSavingOptions = ref(false)

function startEditingOptions() {
  draftOptions.value = vote.value.options.map((option) => ({
    id: option.id,
    label: option.label,
    color: option.color,
    canWin: option.canWin,
  }))
  editingOptions.value = true
}

function cancelEditingOptions() {
  editingOptions.value = false
}

async function saveOptions() {
  isSavingOptions.value = true
  try {
    const currentIds = new Set(vote.value.options.map((option) => option.id))
    const draftIds = new Set(draftOptions.value.filter((o) => o.id).map((o) => o.id!))

    for (const option of vote.value.options) {
      if (!draftIds.has(option.id)) {
        await $fetch(`/api/admin/votes/${voteId}/options/${option.id}`, { method: 'DELETE' })
      }
    }

    const finalIds: string[] = []
    for (const draft of draftOptions.value) {
      if (draft.id && currentIds.has(draft.id)) {
        const original = vote.value.options.find((option) => option.id === draft.id)!
        if (
          original.label !== draft.label ||
          original.color !== draft.color ||
          original.canWin !== draft.canWin
        ) {
          await $fetch(`/api/admin/votes/${voteId}/options/${draft.id}`, {
            method: 'PATCH',
            body: { label: draft.label, color: draft.color, canWin: draft.canWin },
          })
        }
        finalIds.push(draft.id)
      } else {
        const created = await $fetch<{ data: { id: string } }>(
          `/api/admin/votes/${voteId}/options`,
          {
            method: 'POST',
            body: { label: draft.label, color: draft.color, canWin: draft.canWin },
          }
        )
        finalIds.push(created.data.id)
      }
    }

    if (finalIds.length > 0) {
      await $fetch(`/api/admin/votes/${voteId}/options/reorder`, {
        method: 'POST',
        body: { optionIds: finalIds },
      })
    }

    toast.success('Opciones guardadas')
    editingOptions.value = false
    await refresh()
  } catch (err) {
    toast.error(err)
  } finally {
    isSavingOptions.value = false
  }
}

useHead({ title: () => vote.value?.name ?? 'Votación' })
</script>

<template>
  <div class="animate-fade-slide-up space-y-6">
    <NuxtLink
      :to="ADMIN_ROUTES.votes"
      class="text-muted hover:text-highlighted inline-flex items-center gap-1 text-sm"
    >
      <UIcon name="i-lucide-arrow-left" class="size-4" />
      Todas las votaciones
    </NuxtLink>

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge color="neutral" variant="subtle">{{ vote.committee?.name ?? 'Pleno' }}</UBadge>
          <VoteStatus :open="vote.open" />
          <UBadge v-if="!vote.visible" color="warning" variant="subtle" icon="i-lucide-eye-off"
            >Oculta</UBadge
          >
          <UBadge v-if="!vote.showLiveResults" color="info" variant="subtle" icon="i-lucide-eye-off"
            >Resultado público al cerrar</UBadge
          >
          <UBadge
            v-if="vote.allowChange"
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            >Cambio de voto permitido</UBadge
          >
          <LiveIndicator :connected="isConnected" />
        </div>
        <h1 class="text-highlighted mt-2 text-2xl font-bold sm:text-3xl">{{ vote.name }}</h1>
        <p v-if="vote.description" class="text-muted mt-1 max-w-3xl text-sm whitespace-pre-line">
          {{ vote.description }}
        </p>
        <p class="text-muted mt-1 text-xs">
          <template v-if="vote.open && vote.startedAt"
            >Abierta desde {{ formatDateTime(vote.startedAt) }}</template
          >
          <template v-else-if="vote.endedAt">Cerrada {{ formatDateTime(vote.endedAt) }}</template>
          <template v-else>Sin abrir todavía</template>
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          :color="vote.open ? 'error' : 'success'"
          :icon="vote.open ? 'i-lucide-square' : 'i-lucide-play'"
          size="lg"
          :loading="isBusy"
          @click="toggleOpen"
        >
          {{ vote.open ? 'Cerrar votación' : vote.endedAt ? 'Reabrir votación' : 'Abrir votación' }}
        </UButton>
        <UButton icon="i-lucide-pencil" color="neutral" variant="subtle" @click="editVote"
          >Editar</UButton
        >
        <UDropdownMenu
          :items="[
            [
              {
                label: 'Ver página pública',
                icon: 'i-lucide-external-link',
                to: `/v/${vote.id}`,
                target: '_blank',
              },
            ],
            [
              {
                label: 'Borrar todos los votos',
                icon: 'i-lucide-eraser',
                color: 'warning',
                disabled: vote.open,
                onSelect: resetBallots,
              },
              {
                label: 'Eliminar votación',
                icon: 'i-lucide-trash-2',
                color: 'error',
                onSelect: removeVote,
              },
            ],
          ]"
        >
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            aria-label="Más acciones"
          />
        </UDropdownMenu>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div class="space-y-6">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">Participación</h2>
              <span class="text-muted text-xs">{{ vote.pendingUsers.length }} pendientes</span>
            </div>
          </template>
          <VoteParticipation
            :voted="vote.participation.voted"
            :eligible="vote.participation.eligible"
          />
          <div v-if="vote.pendingUsers.length > 0" class="mt-4">
            <p class="text-muted mb-2 text-xs font-semibold uppercase">Falta por votar</p>
            <ul class="max-h-64 space-y-1 overflow-auto">
              <li
                v-for="pending in vote.pendingUsers"
                :key="pending.id"
                class="flex items-center gap-2 text-sm"
              >
                <UserAvatar :user="pending" size="xs" />
                <span class="min-w-0 flex-1 truncate">{{ pending.name }}</span>
                <span
                  v-if="vote.committeeId === null && pending.committee"
                  class="text-muted text-xs"
                  >{{ pending.committee.name }}</span
                >
                <GroupBadge :group="pending.group" size="xs" />
              </li>
            </ul>
          </div>
          <p
            v-else-if="vote.participation.eligible > 0"
            class="mt-3 text-sm text-green-600 dark:text-green-400"
          >
            Todo el mundo ha votado.
          </p>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">Opciones de voto</h2>
              <UButton
                v-if="!editingOptions && !vote.open"
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="startEditingOptions"
              >
                Editar
              </UButton>
            </div>
          </template>

          <template v-if="editingOptions">
            <AdminVoteOptionsEditor v-model="draftOptions" />
            <div class="mt-4 flex justify-end gap-2">
              <UButton color="neutral" variant="outline" size="sm" @click="cancelEditingOptions"
                >Cancelar</UButton
              >
              <UButton
                color="primary"
                size="sm"
                :loading="isSavingOptions"
                :disabled="draftOptions.length === 0"
                @click="saveOptions"
              >
                Guardar opciones
              </UButton>
            </div>
            <p class="text-muted mt-2 text-xs">
              Las opciones con votos ya emitidos no se pueden eliminar.
            </p>
          </template>
          <template v-else>
            <ul class="space-y-1.5">
              <li
                v-for="(option, index) in vote.options"
                :key="option.id"
                class="flex items-center gap-2 text-sm"
              >
                <span
                  class="size-3 rounded-full"
                  :style="{
                    backgroundColor:
                      option.color ?? ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'][index % 4],
                  }"
                />
                <span class="flex-1">{{ option.label }}</span>
                <span v-if="!option.canWin" class="text-muted text-xs">no computa</span>
              </li>
            </ul>
            <p v-if="vote.open" class="text-muted mt-3 text-xs">
              Cierra la votación para editar las opciones.
            </p>
            <p v-if="vote.minimumVotes || vote.maxWinners" class="text-muted mt-3 text-xs">
              <span v-if="vote.minimumVotes">Mayoría mínima: {{ vote.minimumVotes }} votos. </span>
              <span v-if="vote.maxWinners">Máximo de ganadoras: {{ vote.maxWinners }}.</span>
            </p>
          </template>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <h2 class="font-semibold">Resultados</h2>
        </template>
        <VoteResults :vote="vote" />
      </UCard>
    </div>
  </div>
</template>
