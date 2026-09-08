<script setup lang="ts">
/**
 * Password field with a reveal button. Every attribute goes through to the
 * input, so callers keep using `icon`, `size`, `autocomplete` and `class` as if
 * they were writing a UInput.
 */
const model = defineModel<string>({ default: '' })
const show = ref(false)

function toggle() {
  show.value = !show.value
}
</script>

<template>
  <UInput v-model="model" :type="show ? 'text' : 'password'" :ui="{ trailing: 'pe-1' }">
    <template #trailing>
      <UButton
        color="neutral"
        variant="link"
        size="sm"
        :icon="show ? 'i-lucide-eye-off' : 'i-lucide-eye'"
        :aria-label="show ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        :aria-pressed="show"
        @click="toggle"
      />
    </template>
  </UInput>
</template>
