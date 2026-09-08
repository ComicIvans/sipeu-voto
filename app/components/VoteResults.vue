<script setup lang="ts">
import type { VoteWithResults } from '~~/shared/types/api'

const props = withDefaults(
  defineProps<{
    vote: VoteWithResults
    showCommittee?: boolean
  }>(),
  { showCommittee: false }
)

const tabs = computed(() => [
  { label: 'Resultado', icon: 'i-lucide-bar-chart-3', value: 'total', slot: 'total' },
  { label: 'Por grupo', icon: 'i-lucide-flag', value: 'groups', slot: 'groups' },
  {
    label: `Por persona (${props.vote.byUser.length})`,
    icon: 'i-lucide-users',
    value: 'users',
    slot: 'users',
  },
])

const winnerOptions = computed(() =>
  props.vote.options.filter((option) => props.vote.winnerIds.includes(option.id))
)
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="!vote.resultsVisible"
      color="info"
      variant="subtle"
      icon="i-lucide-eye-off"
      title="Resultados ocultos hasta el cierre"
      description="La organización ha configurado esta votación para mostrar el resultado cuando termine. Mientras tanto solo se muestra la participación."
    />

    <template v-if="vote.status === 'closed' && vote.resultsVisible">
      <div v-if="vote.tie" class="border-default bg-muted/60 rounded-xl border p-4">
        <p class="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">Empate</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="option in winnerOptions"
            :key="option.id"
            class="bg-elevated text-highlighted inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
          >
            <UIcon name="i-lucide-scale" class="size-4" />
            {{ option.label }}
          </span>
        </div>
        <p class="text-muted mt-2 text-xs">
          Varias opciones comparten el máximo de votos. La organización decide cómo resolverlo.
        </p>
      </div>

      <div
        v-else-if="winnerOptions.length > 0"
        class="border-eu-300 bg-eu-50 dark:border-eu-700 dark:bg-eu-950/40 rounded-xl border p-4"
      >
        <p class="text-eu-800 dark:text-eu-200 mb-2 text-xs font-semibold tracking-wide uppercase">
          {{ winnerOptions.length > 1 ? 'Opciones ganadoras' : 'Opción ganadora' }}
        </p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="option in winnerOptions"
            :key="option.id"
            class="bg-eu-400 text-eu-950 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
          >
            <UIcon name="i-lucide-trophy" class="size-4" />
            {{ option.label }}
          </span>
        </div>
      </div>

      <div v-else-if="vote.participation.voted > 0" class="text-muted text-sm">
        Sin opción ganadora: ninguna opción que pueda ganar alcanza la mayoría mínima.
      </div>
    </template>

    <UTabs
      :items="tabs"
      default-value="total"
      variant="link"
      color="primary"
      class="w-full"
      :ui="{ list: 'overflow-x-auto' }"
    >
      <template #total>
        <div class="pt-4">
          <VoteChart
            v-if="vote.resultsVisible"
            :options="vote.options"
            :totals="vote.totals"
            :winner-ids="vote.tie ? [] : vote.winnerIds"
            :threshold-reached-ids="vote.thresholdReachedIds"
            :minimum-votes="vote.minimumVotes"
            :is-open="vote.open"
          />
          <VoteParticipation
            v-else
            :voted="vote.participation.voted"
            :eligible="vote.participation.eligible"
          />
        </div>
      </template>
      <template #groups>
        <div class="pt-4">
          <VoteResultsByGroup
            :options="vote.options"
            :by-group="vote.byGroup"
            :results-visible="vote.resultsVisible"
          />
        </div>
      </template>
      <template #users>
        <div class="pt-4">
          <VoteResultsByUser
            :options="vote.options"
            :by-user="vote.byUser"
            :pending-users="vote.pendingUsers"
            :results-visible="vote.resultsVisible"
            :show-committee="showCommittee || vote.committeeId === null"
          />
        </div>
      </template>
    </UTabs>
  </div>
</template>
