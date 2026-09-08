<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    voted: number
    eligible: number
    compact?: boolean
  }>(),
  { compact: false }
)

const pct = computed(() =>
  props.eligible > 0 ? Math.round((props.voted / props.eligible) * 100) : 0
)
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between gap-2" :class="compact ? 'text-xs' : 'text-sm'">
      <span class="text-muted">Participación</span>
      <span class="font-mono font-semibold tabular-nums">
        {{ voted }}/{{ eligible }} · {{ pct }}%
      </span>
    </div>
    <UProgress
      :model-value="pct"
      :max="100"
      color="primary"
      :size="compact ? 'xs' : 'sm'"
      class="mt-1"
    />
  </div>
</template>
