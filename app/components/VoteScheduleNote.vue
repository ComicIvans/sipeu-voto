<script setup lang="ts">
import type { VoteSummary } from '~~/shared/types/api'
import { getVoteStatus } from '~~/shared/utils/voteStatus'

const props = defineProps<{
  vote: Pick<VoteSummary, 'open' | 'startedAt' | 'endedAt' | 'opensAt' | 'closesAt'>
}>()

const { formatDateTime } = useFormatting()

/**
 * Only the half that can still happen. A closed vote's schedule is cleared, and
 * an opening time on a vote that is already open would just be noise.
 */
const note = computed(() => {
  const status = getVoteStatus(props.vote)
  if (status === 'pending' && props.vote.opensAt) {
    return {
      icon: 'i-lucide-alarm-clock',
      text: `Se abrirá el ${formatDateTime(props.vote.opensAt)}`,
    }
  }
  if (status === 'open' && props.vote.closesAt) {
    return {
      icon: 'i-lucide-alarm-clock-off',
      text: `Se cerrará el ${formatDateTime(props.vote.closesAt)}`,
    }
  }
  return null
})
</script>

<template>
  <span v-if="note" class="inline-flex items-baseline gap-1">
    <UIcon :name="note.icon" class="size-3.5 self-center" />
    {{ note.text }}
  </span>
</template>
