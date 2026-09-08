<script setup lang="ts">
import type { CommitteeListItem } from '~~/shared/types/api'

defineProps<{ committee: CommitteeListItem; plenary?: boolean }>()
</script>

<template>
  <NuxtLink
    :to="`/c/${committee.slug}`"
    class="motion-card group border-default bg-default relative block overflow-hidden rounded-xl border shadow-sm"
    :class="plenary ? 'border-sipeu-300 dark:border-sipeu-700' : ''"
  >
    <div class="relative">
      <CommitteeCover :cover="committee.cover" :plenary="plenary" />
      <UBadge
        v-if="committee.votesOpen > 0"
        color="success"
        variant="solid"
        size="sm"
        class="absolute top-3 right-3 shadow"
      >
        {{ committee.votesOpen }} en curso
      </UBadge>
    </div>
    <div class="p-5">
      <h3 class="text-highlighted group-hover:text-primary text-xl font-bold transition-colors">
        {{ committee.name }}
      </h3>
      <p class="text-muted mt-1 text-sm">
        {{ committee.members }} {{ committee.members === 1 ? 'miembro' : 'miembros' }} ·
        {{ committee.votesTotal }} {{ committee.votesTotal === 1 ? 'votación' : 'votaciones' }}
      </p>
      <UIcon
        name="i-lucide-arrow-right"
        class="text-muted absolute right-5 bottom-5 size-5 transition-transform group-hover:translate-x-1"
      />
    </div>
  </NuxtLink>
</template>
