<script setup lang="ts">
/**
 * The one reordering control: grip to drag, arrows to do the same without a
 * pointer. Same shape in the admin tables and in the vote option list so the
 * gesture is learned once.
 */
const props = withDefaults(
  defineProps<{
    /** Named in the labels, so screen readers say what is moving. */
    label: string
    disabled?: boolean
    first?: boolean
    last?: boolean
  }>(),
  { disabled: false, first: false, last: false }
)

const emit = defineEmits<{
  dragstart: [DragEvent]
  dragend: []
  up: []
  down: []
}>()
</script>

<template>
  <div class="flex items-center gap-0.5">
    <span
      :draggable="!props.disabled"
      class="text-muted shrink-0"
      :class="
        props.disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:text-highlighted cursor-grab active:cursor-grabbing'
      "
      :title="`Arrastra para reordenar: ${props.label}`"
      @dragstart="emit('dragstart', $event)"
      @dragend="emit('dragend')"
    >
      <UIcon name="i-lucide-grip-vertical" class="size-5" />
    </span>
    <div class="flex flex-col">
      <UButton
        icon="i-lucide-chevron-up"
        size="xs"
        color="neutral"
        variant="ghost"
        :disabled="props.disabled || props.first"
        :aria-label="`Subir: ${props.label}`"
        @click="emit('up')"
      />
      <UButton
        icon="i-lucide-chevron-down"
        size="xs"
        color="neutral"
        variant="ghost"
        :disabled="props.disabled || props.last"
        :aria-label="`Bajar: ${props.label}`"
        @click="emit('down')"
      />
    </div>
  </div>
</template>
