<script setup lang="ts">
import type { OpenVoteItem } from '~~/shared/types/api'

defineProps<{ votes: OpenVoteItem[] }>()
</script>

<template>
  <div v-if="votes.length > 0" class="space-y-2">
    <NuxtLink
      v-for="vote in votes"
      :key="vote.id"
      :to="`/v/${vote.id}`"
      class="flex items-center gap-3 rounded-xl bg-linear-to-r from-green-600 to-green-700 px-5 py-3.5 text-white transition hover:opacity-90 dark:from-green-700 dark:to-green-800"
    >
      <span class="relative flex size-3 shrink-0">
        <span
          class="animate-pulse-live absolute inline-flex size-full rounded-full bg-white opacity-75"
        />
        <span class="relative inline-flex size-3 rounded-full bg-white" />
      </span>
      <span class="shrink-0 text-sm font-bold uppercase">{{
        vote.committee?.name ?? 'Pleno'
      }}</span>
      <span class="text-white/70">·</span>
      <span class="min-w-0 truncate font-medium">{{ vote.name }}</span>
      <UIcon name="i-lucide-arrow-right" class="ml-auto size-5 shrink-0" />
    </NuxtLink>
  </div>
</template>
