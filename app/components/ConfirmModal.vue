<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmLabel?: string
    color?: 'error' | 'primary' | 'warning'
  }>(),
  { confirmLabel: 'Confirmar', color: 'error', description: undefined }
)

const emit = defineEmits<{ close: [confirmed: boolean] }>()
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :close="{ onClick: () => emit('close', false) }"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer>
      <UButton label="Cancelar" color="neutral" variant="outline" @click="emit('close', false)" />
      <UButton :label="confirmLabel" :color="color" @click="emit('close', true)" />
    </template>
  </UModal>
</template>
