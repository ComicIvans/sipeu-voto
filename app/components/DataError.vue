<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
    retrying?: boolean
  }>(),
  {
    title: 'No se han podido cargar los datos',
    description: 'Comprueba la conexión e inténtalo de nuevo.',
    retrying: false,
  }
)

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <UAlert
    color="error"
    variant="subtle"
    icon="i-lucide-wifi-off"
    :title="title"
    :description="description"
  >
    <template #actions>
      <UButton
        color="error"
        variant="soft"
        size="sm"
        icon="i-lucide-refresh-cw"
        :loading="retrying"
        @click="emit('retry')"
      >
        Reintentar
      </UButton>
    </template>
  </UAlert>
</template>
