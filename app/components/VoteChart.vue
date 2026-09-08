<script setup lang="ts">
import type { VoteOption, VoteResultsOptionTotal } from '~~/shared/types/api'
import { getOptionDisplayColor, roundPercentages } from '~~/shared/utils/votePresentation'

const props = withDefaults(
  defineProps<{
    options: VoteOption[]
    totals: VoteResultsOptionTotal[]
    winnerIds?: string[]
    tiedOptionIds?: string[]
    thresholdReachedIds?: string[]
    minimumVotes?: number | null
    isOpen?: boolean
    compact?: boolean
  }>(),
  {
    winnerIds: () => [],
    tiedOptionIds: () => [],
    thresholdReachedIds: () => [],
    minimumVotes: null,
    isOpen: false,
    compact: false,
  }
)

const { formatNumber } = useFormatting()

const rows = computed(() => {
  const countById = new Map(props.totals.map((total) => [total.optionId, total.count]))
  const withCounts = props.options.map((option, index) => ({
    ...option,
    index,
    count: countById.get(option.id) ?? 0,
    displayColor: getOptionDisplayColor(option.color, index),
  }))
  return props.isOpen ? withCounts : [...withCounts].sort((a, b) => b.count - a.count)
})

const totalVotes = computed(() => rows.value.reduce((sum, row) => sum + row.count, 0))
const percentages = computed(() => roundPercentages(rows.value.map((row) => row.count)))

function isWinner(id: string) {
  return props.winnerIds.includes(id)
}

function isTied(id: string) {
  return props.tiedOptionIds.includes(id)
}

function hasThreshold(id: string) {
  return props.thresholdReachedIds.includes(id)
}
</script>

<template>
  <div :class="compact ? 'space-y-2' : 'space-y-3'">
    <TransitionGroup name="list" tag="div" :class="compact ? 'space-y-1.5' : 'space-y-2.5'">
      <div v-for="(row, index) in rows" :key="row.id">
        <div class="mb-1 flex items-baseline justify-between gap-3">
          <div class="flex min-w-0 items-baseline gap-2">
            <span
              class="size-2.5 shrink-0 self-center rounded-full"
              :style="{ backgroundColor: row.displayColor }"
              aria-hidden="true"
            />
            <span
              class="truncate font-medium"
              :class="[compact ? 'text-sm' : 'text-base', { 'text-muted': !row.canWin }]"
            >
              {{ row.label }}
            </span>
            <UIcon
              v-if="isWinner(row.id)"
              name="i-lucide-trophy"
              class="text-eu-500 size-4 shrink-0"
              aria-label="Opción ganadora"
            />
            <UIcon
              v-else-if="isTied(row.id)"
              name="i-lucide-scale"
              class="text-muted size-4 shrink-0"
              aria-label="Opción empatada"
            />
            <UIcon
              v-else-if="hasThreshold(row.id) && row.canWin"
              name="i-lucide-check"
              class="size-4 shrink-0 text-green-500"
              aria-label="Mayoría mínima alcanzada"
            />
            <span v-if="!row.canWin" class="text-muted text-xs">(no puede ganar)</span>
          </div>
          <span
            class="shrink-0 font-mono font-bold tabular-nums"
            :class="compact ? 'text-sm' : 'text-base'"
          >
            {{ formatNumber(row.count) }} · {{ percentages[index] }}%
          </span>
        </div>
        <VoteBar
          :count="row.count"
          :total="totalVotes"
          :color="row.displayColor"
          :threshold-reached="hasThreshold(row.id) && row.canWin"
          :is-winner="isWinner(row.id)"
          :tall="!compact"
        />
      </div>
    </TransitionGroup>

    <div class="border-default flex items-baseline justify-between border-t pt-2">
      <span class="text-muted text-sm font-medium">Votos emitidos</span>
      <span class="font-mono font-bold tabular-nums" :class="compact ? 'text-base' : 'text-lg'">
        {{ formatNumber(totalVotes) }}
      </span>
    </div>

    <p v-if="minimumVotes" class="text-muted text-xs">Mayoría mínima: {{ minimumVotes }} votos</p>

    <table class="sr-only">
      <caption>
        Resultados de la votación
      </caption>
      <thead>
        <tr>
          <th scope="col">Opción</th>
          <th scope="col">Votos</th>
          <th scope="col">Porcentaje</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.id">
          <td>{{ row.label }}</td>
          <td>{{ row.count }}</td>
          <td>{{ percentages[index] }}%</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
