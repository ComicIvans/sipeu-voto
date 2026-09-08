<script setup lang="ts">
export interface PasswordResult {
  id?: string
  name: string
  email: string
  /** Password stored (always true for freshly created accounts). */
  updated?: boolean
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

function statusOf(result: PasswordResult) {
  if (result.updated === false)
    return { icon: 'i-lucide-x-circle', color: 'text-error', label: 'No guardada' }
  if (result.sent)
    return { icon: 'i-lucide-mail-check', color: 'text-green-500', label: 'Enviada por correo' }
  return { icon: 'i-lucide-mail-warning', color: 'text-amber-500', label: 'Guardada, sin correo' }
}
</script>

<template>
  <UModal :title="title" :close="{ onClick: () => emit('close') }" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div class="space-y-3">
        <UAlert
          v-if="results.some((r) => r.updated === false)"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          title="Algunas contraseñas no se han podido guardar"
          description="Para esas cuentas sigue valiendo la contraseña anterior. Inténtalo de nuevo."
        />
        <UAlert
          v-else-if="results.some((r) => !r.sent)"
          color="warning"
          variant="subtle"
          icon="i-lucide-mail-warning"
          title="Algunas contraseñas no se han enviado por correo"
          description="Están guardadas y funcionan. Cópialas ahora: no volverán a mostrarse."
        />
        <UAlert
          v-else
          color="success"
          variant="subtle"
          icon="i-lucide-mail-check"
          title="Contraseñas guardadas y correos enviados"
        />

        <ul class="divide-default border-default divide-y rounded-lg border">
          <li
            v-for="result in results"
            :key="result.email || result.name"
            class="flex items-center gap-3 px-3 py-2 text-sm"
          >
            <UIcon
              :name="statusOf(result).icon"
              :class="statusOf(result).color"
              class="size-4 shrink-0"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ result.name }}</p>
              <p class="text-muted truncate text-xs">{{ result.email }}</p>
              <p
                v-if="result.error"
                class="text-xs"
                :class="
                  result.updated === false ? 'text-error' : 'text-amber-600 dark:text-amber-400'
                "
              >
                {{ result.error }}
              </p>
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
            <UBadge
              v-else
              :color="result.updated === false ? 'error' : 'success'"
              variant="subtle"
              size="sm"
            >
              {{ statusOf(result).label }}
            </UBadge>
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
