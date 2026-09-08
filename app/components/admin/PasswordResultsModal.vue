<script setup lang="ts">
export interface PasswordResult {
  id?: string
  name: string
  email: string
  sent: boolean
  password?: string
  error?: string
}

defineProps<{
  title: string
  results: PasswordResult[]
}>()

const emit = defineEmits<{ close: [] }>()
const { copy, copied } = useClipboard()
</script>

<template>
  <UModal :title="title" :close="{ onClick: () => emit('close') }" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div class="space-y-3">
        <UAlert
          v-if="results.some((r) => !r.sent)"
          color="warning"
          variant="subtle"
          icon="i-lucide-mail-warning"
          title="Algunas contraseñas no se han enviado por correo"
          description="Cópialas ahora: no volverán a mostrarse."
        />
        <UAlert
          v-else
          color="success"
          variant="subtle"
          icon="i-lucide-mail-check"
          title="Correos enviados correctamente"
        />

        <ul class="divide-default border-default divide-y rounded-lg border">
          <li
            v-for="result in results"
            :key="result.email"
            class="flex items-center gap-3 px-3 py-2 text-sm"
          >
            <UIcon
              :name="result.sent ? 'i-lucide-check-circle-2' : 'i-lucide-alert-circle'"
              :class="result.sent ? 'text-green-500' : 'text-amber-500'"
              class="size-4 shrink-0"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ result.name }}</p>
              <p class="text-muted truncate text-xs">{{ result.email }}</p>
              <p v-if="result.error" class="text-error text-xs">{{ result.error }}</p>
            </div>
            <div v-if="result.password" class="flex items-center gap-1">
              <code class="bg-muted rounded px-2 py-0.5 font-mono text-xs">{{
                result.password
              }}</code>
              <UButton
                icon="i-lucide-copy"
                size="xs"
                color="neutral"
                variant="ghost"
                aria-label="Copiar contraseña"
                @click="copy(result.password!)"
              />
            </div>
            <UBadge v-else color="success" variant="subtle" size="sm">Enviada</UBadge>
          </li>
        </ul>
        <p v-if="copied" class="text-muted text-xs">Copiado al portapapeles.</p>
      </div>
    </template>
    <template #footer>
      <UButton label="Cerrar" color="primary" @click="emit('close')" />
    </template>
  </UModal>
</template>
