<script setup lang="ts">
import type { VoteDetail } from '~~/shared/types/api'

const route = useRoute()
const voteId = route.params.id as string
const { user } = useAuth()
const { formatDateTime } = useFormatting()

const { data, error, refresh, status } = await useFetch<{ data: VoteDetail }>(
  `/api/votes/${voteId}`
)

if (error.value && !data.value && getApiErrorStatus(error.value) === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Votación no encontrada', fatal: true })
}

const vote = computed(() => data.value?.data ?? null)

const { isConnected } = useLiveRefresh(refresh, (event) => {
  if (event.type === 'vote-changed') return event.voteId === voteId
  return event.scope === 'users' || event.scope === 'groups' || event.scope === 'votes'
})

const showVotingPanel = computed(
  () => Boolean(user.value) && Boolean(vote.value?.canVote) && vote.value?.open === true
)
const backLink = computed(() => `/c/${vote.value?.committee?.slug ?? 'pleno'}`)

useHead({ title: () => vote.value?.name ?? 'Votación' })
</script>

<template>
  <UContainer class="animate-fade-slide-up py-8 sm:py-12">
    <DataError v-if="!vote" :retrying="status === 'pending'" @retry="refresh" />

    <template v-else>
      <NuxtLink
        :to="backLink"
        class="text-muted hover:text-highlighted inline-flex items-center gap-1 text-sm"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" />
        {{ vote.committee?.name ?? 'Pleno' }}
      </NuxtLink>

      <div class="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <VoteStatusBadge :status="vote.status" />
            <LiveIndicator :connected="isConnected" />
            <UBadge v-if="error" color="warning" variant="subtle" icon="i-lucide-wifi-off"
              >Datos desactualizados</UBadge
            >
          </div>
          <h1
            class="text-highlighted mt-2 text-3xl font-bold tracking-tight break-words sm:text-4xl"
          >
            {{ vote.name }}
          </h1>
          <p v-if="vote.description" class="text-muted mt-2 max-w-3xl whitespace-pre-line">
            {{ vote.description }}
          </p>
          <p class="text-muted mt-2 text-sm">
            <template v-if="vote.open && vote.startedAt"
              >Abierta desde {{ formatDateTime(vote.startedAt) }}</template
            >
            <template v-else-if="vote.status === 'closed'"
              >Finalizada {{ formatDateTime(vote.endedAt) }}</template
            >
            <template v-else>Aún no se ha abierto</template>
            <VoteScheduleNote :vote="vote" class="text-muted ml-2" />
          </p>
        </div>
        <div class="w-full sm:w-64">
          <VoteParticipation
            :voted="vote.participation.voted"
            :eligible="vote.participation.eligible"
          />
        </div>
      </div>

      <div
        class="mt-8 grid grid-cols-1 gap-6"
        :class="showVotingPanel ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]' : ''"
      >
        <BallotPanel v-if="showVotingPanel" :vote="vote" @voted="refresh" />
        <div
          v-else-if="user && vote.myBallot"
          class="border-default bg-default rounded-2xl border p-5 shadow-sm lg:hidden"
        >
          <p class="text-muted text-sm">Tu voto</p>
          <p class="text-highlighted text-lg font-semibold">
            {{ vote.options.find((o) => o.id === vote?.myBallot?.optionId)?.label }}
          </p>
        </div>

        <div class="border-default bg-default rounded-2xl border p-5 shadow-sm sm:p-6">
          <VoteResults :vote="vote" />
        </div>
      </div>
    </template>
  </UContainer>
</template>
