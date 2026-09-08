<script setup lang="ts">
import type { VoteSummary } from '~~/shared/types/api'

const props = withDefaults(
  defineProps<{
    vote: VoteSummary & { myOptionId?: string | null }
    showCommittee?: boolean
  }>(),
  { showCommittee: false }
)

const { formatDateTime } = useFormatting()

const winnerLabels = computed(() =>
  props.vote.options.filter((o) => props.vote.winnerIds.includes(o.id)).map((o) => o.label)
)

const tiedLabels = computed(() =>
  props.vote.options.filter((o) => props.vote.tiedOptionIds.includes(o.id)).map((o) => o.label)
)

const myOptionLabel = computed(() =>
  props.vote.myOptionId
    ? (props.vote.options.find((o) => o.id === props.vote.myOptionId)?.label ?? null)
    : null
)
</script>

<template>
  <NuxtLink
    :to="`/v/${vote.id}`"
    class="motion-card border-default bg-default block overflow-hidden rounded-xl border shadow-sm"
    :class="vote.open ? 'ring-1 ring-green-500/40' : ''"
  >
    <div class="flex items-start justify-between gap-3 px-5 pt-4">
      <div class="min-w-0">
        <p v-if="showCommittee" class="text-muted mb-0.5 text-xs font-semibold uppercase">
          {{ vote.committee?.name ?? 'Pleno' }}
        </p>
        <h3 class="text-highlighted leading-snug font-semibold">{{ vote.name }}</h3>
        <p class="text-muted mt-0.5 text-xs">
          <template v-if="vote.open && vote.startedAt"
            >Abierta desde {{ formatDateTime(vote.startedAt) }}</template
          >
          <template v-else-if="vote.endedAt">Cerrada {{ formatDateTime(vote.endedAt) }}</template>
          <template v-else>Aún no se ha abierto</template>
        </p>
      </div>
      <VoteStatusBadge :status="vote.status" size="sm" />
    </div>

    <div class="px-5 pt-3 pb-4">
      <VoteParticipation
        :voted="vote.participation.voted"
        :eligible="vote.participation.eligible"
        compact
      />

      <div v-if="vote.resultsVisible && vote.participation.voted > 0" class="mt-3">
        <VoteChart
          :options="vote.options"
          :totals="vote.totals"
          :winner-ids="vote.winnerIds"
          :tied-option-ids="vote.tiedOptionIds"
          :threshold-reached-ids="vote.thresholdReachedIds"
          :is-open="vote.open"
          compact
        />
      </div>
      <p v-else-if="!vote.resultsVisible" class="text-muted mt-3 text-xs">
        Resultados visibles al cerrar la votación.
      </p>

      <div
        v-if="vote.status === 'closed' && (winnerLabels.length > 0 || tiedLabels.length > 0)"
        class="mt-3 flex flex-wrap gap-1.5"
      >
        <span
          v-for="label in winnerLabels"
          :key="label"
          class="bg-eu-100 text-eu-900 dark:bg-eu-900/40 dark:text-eu-200 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          <UIcon name="i-lucide-trophy" class="size-3" />
          {{ label }}
        </span>
        <span
          v-if="tiedLabels.length > 0"
          class="bg-muted text-highlighted inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          <UIcon name="i-lucide-scale" class="size-3" />
          Empate: {{ tiedLabels.join(' / ') }}
        </span>
      </div>

      <div v-if="myOptionLabel" class="text-muted mt-3 flex items-center gap-1.5 text-xs">
        <UIcon name="i-lucide-check-circle-2" class="size-3.5 text-green-500" />
        Tu voto: <span class="text-highlighted font-medium">{{ myOptionLabel }}</span>
      </div>
    </div>
  </NuxtLink>
</template>
