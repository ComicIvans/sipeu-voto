<script setup lang="ts">
import type { VoteOption, VoteResultsGroup } from '~~/shared/types/api'
import { getOptionDisplayColor } from '~~/shared/utils/votePresentation'

const props = defineProps<{
  options: VoteOption[]
  byGroup: VoteResultsGroup[]
  resultsVisible: boolean
}>()

const optionsWithColor = computed(() =>
  props.options.map((option, index) => ({
    ...option,
    displayColor: getOptionDisplayColor(option.color, index),
  }))
)

const groups = computed(() =>
  props.byGroup.map((entry) => {
    const segments = optionsWithColor.value.map((option) => ({
      ...option,
      count: entry.counts[option.id] ?? 0,
    }))
    const total = segments.reduce((sum, segment) => sum + segment.count, 0)
    const leader = [...segments].sort((a, b) => b.count - a.count)[0]
    return {
      ...entry,
      segments,
      total,
      leader: leader && leader.count > 0 ? leader : null,
      pct: entry.eligible > 0 ? Math.round((entry.voted / entry.eligible) * 100) : 0,
    }
  })
)
</script>

<template>
  <div class="space-y-3">
    <div v-if="resultsVisible" class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <span
        v-for="option in optionsWithColor"
        :key="option.id"
        class="inline-flex items-center gap-1.5"
      >
        <span class="size-2.5 rounded-full" :style="{ backgroundColor: option.displayColor }" />
        {{ option.label }}
      </span>
    </div>

    <div v-if="groups.length === 0" class="text-muted py-6 text-center text-sm">
      Nadie con derecho a voto en esta votación.
    </div>

    <ul v-else class="divide-default divide-y">
      <li v-for="entry in groups" :key="entry.group?.id ?? 'none'" class="py-3">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <GroupBadge :group="entry.group" size="md" />
            <span class="text-muted truncate text-sm">{{ entry.group?.name ?? 'Sin grupo' }}</span>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <span v-if="resultsVisible && entry.leader" class="text-muted hidden sm:inline">
              Mayoría:
              <span class="text-highlighted font-medium">{{ entry.leader.label }}</span>
            </span>
            <span class="font-mono tabular-nums">
              {{ entry.voted }}/{{ entry.eligible }}
              <span class="text-muted">· {{ entry.pct }}%</span>
            </span>
          </div>
        </div>

        <div
          v-if="resultsVisible"
          class="bg-muted flex h-6 w-full overflow-hidden rounded-md"
          role="img"
          :aria-label="`Votos de ${entry.group?.name ?? 'sin grupo'}`"
        >
          <div
            v-for="segment in entry.segments.filter((s) => s.count > 0)"
            :key="segment.id"
            class="flex items-center justify-center text-[11px] font-semibold text-white transition-[width] duration-500"
            :style="{
              width: `${(segment.count / Math.max(entry.total, 1)) * 100}%`,
              backgroundColor: segment.displayColor,
            }"
            :title="`${segment.label}: ${segment.count}`"
          >
            <span v-if="segment.count / Math.max(entry.total, 1) > 0.12">{{ segment.count }}</span>
          </div>
          <div
            v-if="entry.total === 0"
            class="text-muted flex w-full items-center justify-center text-[11px]"
          >
            Sin votos
          </div>
        </div>
        <UProgress v-else :model-value="entry.pct" :max="100" size="sm" color="primary" />

        <div v-if="resultsVisible" class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span
            v-for="segment in entry.segments"
            :key="segment.id"
            class="inline-flex items-center gap-1"
            :class="segment.count === 0 ? 'text-muted' : ''"
          >
            <span class="size-2 rounded-full" :style="{ backgroundColor: segment.displayColor }" />
            {{ segment.label }}
            <span class="font-mono font-semibold tabular-nums">{{ segment.count }}</span>
          </span>
        </div>
      </li>
    </ul>
  </div>
</template>
