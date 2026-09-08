<script setup lang="ts">
defineProps<{
  name: string
  image: string
}>()

const emit = defineEmits<{ close: [action: 'none' | 'remove'] }>()
</script>

<template>
  <UModal
    :title="name"
    description="Comprueba que es una foto de su cara."
    :close="{ onClick: () => emit('close', 'none') }"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <img
        :src="image"
        :alt="`Foto de ${name}`"
        class="mx-auto max-h-[60vh] rounded-xl object-contain"
      />
    </template>
    <template #footer>
      <UButton label="Cerrar" color="neutral" variant="outline" @click="emit('close', 'none')" />
      <UButton
        label="Retirar foto"
        color="warning"
        icon="i-lucide-image-off"
        @click="emit('close', 'remove')"
      />
    </template>
  </UModal>
</template>
