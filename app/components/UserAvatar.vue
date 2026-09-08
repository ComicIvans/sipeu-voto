<script setup lang="ts">
import { getInitials } from '~~/shared/utils/names'

const props = withDefaults(
  defineProps<{
    user: { name: string; image?: string | null } | null | undefined
    size?: '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  }>(),
  { size: 'md' }
)

const initials = computed(() => getInitials(props.user?.name ?? ''))
</script>

<template>
  <UAvatar
    :src="user?.image ?? undefined"
    :alt="user?.name ?? ''"
    :text="initials"
    :size="size"
    class="bg-sipeu-100 text-sipeu-800 dark:bg-sipeu-900 dark:text-sipeu-100"
  />
</template>
