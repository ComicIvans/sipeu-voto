<script setup lang="ts">
import type { VoteStatus } from '~~/shared/utils/voteStatus'
import { VOTE_STATUS_LABELS } from '~~/shared/utils/voteStatus'

const props = withDefaults(
  defineProps<{ status?: VoteStatus; open?: boolean; size?: 'sm' | 'md' | 'lg' }>(),
  { status: undefined, open: false, size: 'md' }
)

const effectiveStatus = computed<VoteStatus>(() => props.status ?? (props.open ? 'open' : 'closed'))

const color = computed(() => {
  if (effectiveStatus.value === 'open') return 'success' as const
  if (effectiveStatus.value === 'pending') return 'warning' as const
  return 'neutral' as const
})
</script>

<template>
  <UBadge
    :color="color"
    :variant="effectiveStatus === 'open' ? 'solid' : 'subtle'"
    :size="size"
    class="inline-flex items-center gap-1.5"
  >
    <span v-if="effectiveStatus === 'open'" class="relative flex size-2">
      <span
        class="animate-pulse-live absolute inline-flex size-full rounded-full bg-white opacity-75"
      />
      <span class="relative inline-flex size-2 rounded-full bg-white" />
    </span>
    <UIcon v-else-if="effectiveStatus === 'pending'" name="i-lucide-clock" class="size-3" />
    {{ VOTE_STATUS_LABELS[effectiveStatus] }}
  </UBadge>
</template>
