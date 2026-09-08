<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    cover: string | null | undefined
    plenary?: boolean
    /** Dims the image so text laid over it stays readable. */
    scrim?: boolean
  }>(),
  { plenary: false, scrim: false }
)

// A cover that 404s (deleted file, empty restore) has to look like no cover at
// all, not like a broken image.
const failed = ref(false)
watch(
  () => props.cover,
  () => {
    failed.value = false
  }
)

const showCover = computed(() => Boolean(props.cover) && !failed.value)
</script>

<template>
  <div class="relative aspect-[16/9] w-full overflow-hidden">
    <img
      v-if="showCover"
      :src="cover!"
      alt=""
      aria-hidden="true"
      class="size-full object-cover"
      @error="failed = true"
    />
    <div
      v-else
      class="flex size-full items-center justify-center"
      :class="
        plenary
          ? 'bg-eu-100 text-eu-700 dark:bg-eu-900/40 dark:text-eu-200'
          : 'bg-sipeu-50 text-sipeu-600 dark:bg-sipeu-900/40 dark:text-sipeu-200'
      "
    >
      <UIcon :name="plenary ? 'i-lucide-star' : 'i-lucide-landmark'" class="size-10 opacity-70" />
    </div>
    <div
      v-if="scrim"
      class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-black/25"
      aria-hidden="true"
    />
  </div>
</template>
