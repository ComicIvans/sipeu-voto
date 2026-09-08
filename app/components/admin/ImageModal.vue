<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    /** What this image is used for, in one line. */
    description: string
    currentUrl: string | null
    uploadUrl: string
    deleteUrl: string
    /** Wide covers are cropped to 16:9; logos keep their shape. */
    shape: 'wide' | 'square'
    hint?: string
  }>(),
  { hint: undefined }
)

const emit = defineEmits<{ close: [changed: boolean] }>()

const toast = useApiToast()
const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const isBusy = ref(false)
const changed = ref(false)

watch(file, (picked) => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = picked ? URL.createObjectURL(picked) : null
})

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

async function upload() {
  if (!file.value) return
  isBusy.value = true
  try {
    const body = new FormData()
    body.append('file', file.value)
    await $fetch(props.uploadUrl, { method: 'POST', body })
    changed.value = true
    toast.success('Imagen guardada')
    emit('close', true)
  } catch (error) {
    toast.error(error)
  } finally {
    isBusy.value = false
  }
}

async function remove() {
  isBusy.value = true
  try {
    await $fetch(props.deleteUrl, { method: 'DELETE' })
    changed.value = true
    toast.success('Imagen quitada')
    emit('close', true)
  } catch (error) {
    toast.error(error)
  } finally {
    isBusy.value = false
  }
}
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :close="{ onClick: () => emit('close', changed) }"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          title="Los cambios se aplican al instante"
          description="Subir o quitar la imagen se guarda al pulsar el botón. Cerrar esta ventana no deshace nada."
        />

        <div>
          <p class="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">Imagen actual</p>
          <div
            class="border-default bg-elevated overflow-hidden rounded-lg border"
            :class="shape === 'wide' ? 'w-full' : 'size-28'"
          >
            <img
              v-if="currentUrl"
              :src="currentUrl"
              alt=""
              aria-hidden="true"
              class="w-full bg-white"
              :class="shape === 'wide' ? 'aspect-[16/9] object-cover' : 'size-28 object-contain'"
            />
            <div
              v-else
              class="text-muted flex items-center justify-center text-xs"
              :class="shape === 'wide' ? 'aspect-[16/9]' : 'size-28'"
            >
              Sin imagen
            </div>
          </div>
        </div>

        <UFormField label="Nueva imagen" :hint="hint">
          <UFileUpload
            v-model="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            label="Elige una imagen"
            description="JPG, PNG, WebP o AVIF · máx. 8 MB"
            icon="i-lucide-image-plus"
            class="w-full"
            :preview="false"
          />
        </UFormField>

        <div v-if="previewUrl">
          <p class="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
            Vista previa
            <span v-if="shape === 'wide'" class="normal-case"
              >— se recortará a 16:9, así que el encuadre final puede variar</span
            >
          </p>
          <div
            class="border-default overflow-hidden rounded-lg border bg-white"
            :class="shape === 'wide' ? 'w-full' : 'size-28'"
          >
            <img
              :src="previewUrl"
              alt=""
              aria-hidden="true"
              class="w-full"
              :class="shape === 'wide' ? 'aspect-[16/9] object-cover' : 'size-28 object-contain'"
            />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-3">
        <UButton
          v-if="currentUrl"
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          :disabled="isBusy"
          @click="remove"
        >
          Quitar imagen
        </UButton>
        <span v-else />
        <div class="flex gap-2">
          <UButton color="neutral" variant="outline" @click="emit('close', changed)">
            Cerrar
          </UButton>
          <UButton color="primary" :disabled="!file" :loading="isBusy" @click="upload">
            Guardar imagen
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
