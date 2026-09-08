<script setup lang="ts">
import type { PublicGroup } from '~~/shared/types/api'
import { DEFAULT_GROUP_ICON, iconName } from '~~/shared/constants/icons'

const props = withDefaults(
  defineProps<{
    group: PublicGroup | null | undefined
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' }
)

// The box keeps its size whether the logo loads or not, so rows never jump.
const failed = ref(false)
watch(
  () => props.group?.logo,
  () => {
    failed.value = false
  }
)

const showLogo = computed(() => Boolean(props.group?.logo) && !failed.value)

const boxClass = computed(
  () =>
    ({
      sm: 'size-7 p-0.5',
      md: 'size-9 p-1',
      lg: 'size-14 p-1.5',
    })[props.size]
)
const iconClass = computed(() => ({ sm: 'size-4', md: 'size-5', lg: 'size-7' })[props.size])
</script>

<template>
  <span
    class="border-default inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border"
    :class="[boxClass, showLogo ? 'bg-white' : 'bg-elevated']"
  >
    <!-- The group name is always next to it, so the logo adds nothing to read. -->
    <img
      v-if="showLogo"
      :src="group!.logo!"
      alt=""
      aria-hidden="true"
      class="size-full object-contain"
      @error="failed = true"
    />
    <UIcon
      v-else
      :name="iconName(group?.icon, DEFAULT_GROUP_ICON)"
      :class="iconClass"
      :style="{ color: group?.color ?? undefined }"
      aria-hidden="true"
    />
  </span>
</template>
