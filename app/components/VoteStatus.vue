<script setup lang="ts">
withDefaults(defineProps<{ open: boolean; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
</script>

<template>
  <UBadge
    :color="open ? 'success' : 'neutral'"
    :variant="open ? 'solid' : 'subtle'"
    :size="size"
    class="inline-flex items-center gap-1.5"
  >
    <span v-if="open" class="relative flex size-2">
      <span
        class="animate-pulse-live absolute inline-flex size-full rounded-full bg-white opacity-75"
      />
      <span class="relative inline-flex size-2 rounded-full bg-white" />
    </span>
    {{ open ? 'Abierta' : 'Cerrada' }}
  </UBadge>
</template>
