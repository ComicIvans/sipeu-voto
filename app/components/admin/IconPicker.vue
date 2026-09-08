<script setup lang="ts">
import { iconName } from '~~/shared/constants/icons'

const props = defineProps<{
  /** Names without the `i-lucide-` prefix. */
  icons: readonly string[]
  /** Shown as the selected one when nothing is chosen. */
  fallback: string
}>()

const model = defineModel<string | null>({ default: null })

function choose(icon: string | null) {
  model.value = model.value === icon ? null : icon
}
</script>

<template>
  <div class="border-default max-h-44 overflow-y-auto rounded-lg border p-2">
    <div class="flex flex-wrap gap-1">
      <UButton
        :color="model === null ? 'primary' : 'neutral'"
        :variant="model === null ? 'soft' : 'ghost'"
        size="sm"
        :icon="iconName(null, props.fallback)"
        aria-label="Icono por defecto"
        :aria-pressed="model === null"
        @click="choose(null)"
      >
        Por defecto
      </UButton>
      <UButton
        v-for="icon in props.icons"
        :key="icon"
        :color="model === icon ? 'primary' : 'neutral'"
        :variant="model === icon ? 'soft' : 'ghost'"
        size="sm"
        :icon="iconName(icon, props.fallback)"
        :aria-label="icon"
        :aria-pressed="model === icon"
        @click="choose(icon)"
      />
    </div>
  </div>
</template>
