<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const { user, refresh, changePassword: changeAuthPassword } = useAuth()
const toast = useApiToast()

// ─── Avatar ──────────────────────────────────────────────────────────────────
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const isUploading = ref(false)
const isRemoving = ref(false)

watch(avatarFile, (file) => {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarPreview.value = file ? URL.createObjectURL(file) : null
})

async function uploadAvatar() {
  if (!avatarFile.value) return
  isUploading.value = true
  try {
    const form = new FormData()
    form.append('file', avatarFile.value)
    await $fetch('/api/me/avatar', { method: 'POST', body: form })
    avatarFile.value = null
    await refresh()
    toast.success('Foto actualizada')
  } catch (error) {
    toast.error(error, 'No se ha podido subir la foto.')
  } finally {
    isUploading.value = false
  }
}

async function removeAvatar() {
  isRemoving.value = true
  try {
    await $fetch('/api/me/avatar', { method: 'DELETE' })
    await refresh()
    toast.success('Foto eliminada')
  } catch (error) {
    toast.error(error, 'No se ha podido eliminar la foto.')
  } finally {
    isRemoving.value = false
  }
}

// ─── Password ────────────────────────────────────────────────────────────────
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Introduce tu contraseña actual'),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres').max(128),
    confirmPassword: z.string().min(1, 'Repite la nueva contraseña'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })
type PasswordSchema = z.output<typeof passwordSchema>

const passwordState = reactive<Partial<PasswordSchema>>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const isChangingPassword = ref(false)

async function changePassword(event: FormSubmitEvent<PasswordSchema>) {
  isChangingPassword.value = true
  try {
    await changeAuthPassword(event.data.currentPassword, event.data.newPassword)
    passwordState.currentPassword = ''
    passwordState.newPassword = ''
    passwordState.confirmPassword = ''
    toast.success('Contraseña actualizada', 'Las demás sesiones abiertas se han cerrado.')
  } catch (error) {
    toast.error(
      error instanceof Error ? { data: { message: error.message }, statusCode: 400 } : error,
      'No se ha podido cambiar la contraseña.'
    )
  } finally {
    isChangingPassword.value = false
  }
}

useHead({ title: 'Mi perfil' })
</script>

<template>
  <UContainer class="animate-fade-slide-up max-w-4xl py-8 sm:py-12">
    <h1 class="text-highlighted text-2xl font-bold sm:text-3xl">Mi perfil</h1>

    <div class="mt-6 grid gap-6 md:grid-cols-2">
      <UCard>
        <template #header>
          <h2 class="font-semibold">Foto de perfil</h2>
        </template>

        <div class="flex flex-col items-center gap-4">
          <UAvatar
            :src="avatarPreview ?? user?.image ?? undefined"
            :alt="user?.name ?? ''"
            :text="user?.name?.slice(0, 2).toUpperCase()"
            size="3xl"
            class="size-32 text-3xl"
          />

          <UAlert
            v-if="user?.photoRemovedAt && !user.image"
            color="warning"
            variant="subtle"
            icon="i-lucide-alert-triangle"
            title="La organización retiró tu foto anterior"
            description="Sube una foto en la que se vea claramente tu cara."
            class="w-full"
          />

          <p class="text-muted text-center text-sm">
            Debe ser una foto <span class="text-highlighted font-medium">de tu cara</span>,
            reconocible. No se admiten otras imágenes; la organización puede retirarlas.
          </p>

          <UFileUpload
            v-model="avatarFile"
            accept="image/jpeg,image/png,image/webp,image/avif"
            label="Elige una imagen"
            description="JPG, PNG, WebP o AVIF · máx. 8 MB"
            icon="i-lucide-image-plus"
            class="w-full"
            :preview="false"
          />

          <div class="flex w-full gap-2">
            <UButton
              block
              color="primary"
              icon="i-lucide-upload"
              :disabled="!avatarFile"
              :loading="isUploading"
              @click="uploadAvatar"
            >
              Subir foto
            </UButton>
            <UButton
              v-if="user?.image"
              color="neutral"
              variant="outline"
              icon="i-lucide-trash-2"
              :loading="isRemoving"
              @click="removeAvatar"
            >
              Quitar
            </UButton>
          </div>
        </div>
      </UCard>

      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="font-semibold">Mis datos</h2>
          </template>
          <dl class="space-y-3 text-sm">
            <div>
              <dt class="text-muted">Nombre</dt>
              <dd class="text-highlighted font-medium">{{ user?.name }}</dd>
            </div>
            <div>
              <dt class="text-muted">Correo</dt>
              <dd class="text-highlighted font-medium">{{ user?.email }}</dd>
            </div>
            <div>
              <dt class="text-muted">Comisión</dt>
              <dd class="text-highlighted font-medium">
                {{ user?.committee?.name ?? 'Sin asignar' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">Grupo parlamentario</dt>
              <dd class="mt-0.5"><GroupBadge :group="user?.group" full /></dd>
            </div>
          </dl>
          <p class="text-muted mt-4 text-xs">
            Si algún dato no es correcto, contacta con la organización.
          </p>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold">Cambiar contraseña</h2>
          </template>
          <UForm
            :schema="passwordSchema"
            :state="passwordState"
            class="space-y-3"
            @submit="changePassword"
          >
            <UFormField name="currentPassword" label="Contraseña actual" required>
              <UInput
                v-model="passwordState.currentPassword"
                type="password"
                autocomplete="current-password"
                class="w-full"
              />
            </UFormField>
            <UFormField name="newPassword" label="Nueva contraseña" required>
              <UInput
                v-model="passwordState.newPassword"
                type="password"
                autocomplete="new-password"
                class="w-full"
              />
            </UFormField>
            <UFormField name="confirmPassword" label="Repite la nueva contraseña" required>
              <UInput
                v-model="passwordState.confirmPassword"
                type="password"
                autocomplete="new-password"
                class="w-full"
              />
            </UFormField>
            <UButton
              type="submit"
              color="primary"
              icon="i-lucide-key-round"
              :loading="isChangingPassword"
            >
              Guardar contraseña
            </UButton>
          </UForm>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>
