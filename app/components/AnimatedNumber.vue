<script setup lang="ts">
/**
 * A number that says it has changed.
 *
 * Results arrive over the live connection while people are looking at the
 * screen. A ballot moves a count by one, and no roll of the digits can show a
 * step that small, so the number gives a short pulse instead. Larger jumps —
 * a reconnection catching up, a vote reopened — do roll, because there the
 * distance travelled is the information.
 */
const props = withDefaults(
  defineProps<{
    value: number
    /** Rendered form, so the thousands separator stays the Spanish one. */
    format?: (value: number) => string
    duration?: number
  }>(),
  { format: undefined, duration: 500 }
)

const displayed = useCountUp(() => props.value, props.duration)
const text = computed(() =>
  props.format ? props.format(displayed.value) : String(displayed.value)
)

// Rebuilding the element is what restarts the animation; removing the class and
// putting it back within one update does nothing.
const changes = ref(0)
watch(
  () => props.value,
  () => changes.value++
)
</script>

<template>
  <span :key="changes" class="tabular-nums" :class="changes > 0 ? 'number-bump' : ''">
    {{ text }}
  </span>
</template>
