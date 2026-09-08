<script setup lang="ts">
import type { CommitteeListItem } from '~~/shared/types/api'

defineProps<{ committee: CommitteeListItem; plenary?: boolean }>()
</script>

<template>
  <NuxtLink
    :to="`/c/${committee.slug}`"
    class="motion-card group border-default bg-default relative block overflow-hidden rounded-xl border p-5 shadow-sm"
    :class="plenary ? 'border-sipeu-300 dark:border-sipeu-700' : ''"
  >
    <div class="flex items-start justify-between gap-3">
      <div
        class="flex size-11 shrink-0 items-center justify-center rounded-lg"
        :class="
          plenary
            ? 'bg-eu-100 text-eu-800 dark:bg-eu-900/40 dark:text-eu-200'
            : 'bg-sipeu-50 text-sipeu-700 dark:bg-sipeu-900/50 dark:text-sipeu-200'
        "
      >
        <UIcon :name="plenary ? 'i-lucide-star' : 'i-lucide-landmark'" class="size-5" />
      </div>
      <UBadge v-if="committee.votesOpen > 0" color="success" variant="solid" size="sm">
        {{ committee.votesOpen }} en curso
      </UBadge>
    </div>
    <h3 class="text-highlighted group-hover:text-primary mt-4 text-xl font-bold transition-colors">
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
  </NuxtLink>
</template>
