<script setup lang="ts">
import type { PublicGroup } from '~~/shared/types/api'
import { getContrastTextColor } from '~~/shared/utils/votePresentation'

withDefaults(
  defineProps<{
    group: PublicGroup | null | undefined
    full?: boolean
    size?: 'xs' | 'sm' | 'md'
  }>(),
  { full: false, size: 'sm' }
)
</script>

<template>
  <span
    v-if="group"
    class="inline-flex max-w-full items-center gap-1.5 rounded-full font-semibold whitespace-nowrap"
    :class="{
      'px-2 py-0.5 text-[11px]': size === 'xs',
      'px-2.5 py-0.5 text-xs': size === 'sm',
      'px-3 py-1 text-sm': size === 'md',
    }"
    :style="{ backgroundColor: group.color, color: getContrastTextColor(group.color) }"
    :title="group.name"
  >
    <span class="truncate">{{ full ? group.name : group.abbreviation }}</span>
  </span>
  <span v-else class="text-muted text-xs">Sin grupo</span>
</template>
