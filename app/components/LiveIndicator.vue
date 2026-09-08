<script setup lang="ts">
defineProps<{ connected: boolean }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase"
    :class="connected ? 'text-green-600 dark:text-green-400' : 'text-muted'"
    role="status"
  >
    <span class="relative flex size-2">
      <span
        v-if="connected"
        class="animate-pulse-live absolute inline-flex size-full rounded-full bg-green-400 opacity-75"
      />
      <span
        class="relative inline-flex size-2 rounded-full"
        :class="connected ? 'bg-green-500' : 'bg-neutral-400'"
      />
    </span>
    {{ connected ? 'En directo' : 'Reconectando' }}
  </span>
</template>
