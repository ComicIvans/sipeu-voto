<script setup lang="ts">
const props = defineProps<{
  count: number
  total: number
  color: string
  thresholdReached?: boolean
  isWinner?: boolean
  /** The vote is still open, so this length is provisional. */
  live?: boolean
  tall?: boolean
}>()

const pct = computed(() => (props.total > 0 ? (props.count / props.total) * 100 : 0))

const barStyle = computed(() => ({
  width: `${pct.value}%`,
  backgroundColor: props.color,
  minWidth: props.count > 0 ? '0.35rem' : '0',
}))
</script>

<template>
  <div
    class="bg-muted overflow-hidden rounded-md transition-shadow duration-300"
    :class="[
      tall ? 'h-8' : 'h-5',
      { 'ring-2 ring-green-500 ring-offset-1': thresholdReached && !isWinner },
      { 'ring-eu-400 ring-2 ring-offset-1': isWinner },
    ]"
    aria-hidden="true"
  >
    <div
      class="h-full rounded-md transition-[width,min-width,background-color] duration-500 ease-out"
      :class="live && count > 0 ? 'bar-live' : ''"
      :style="barStyle"
    />
  </div>
</template>
