<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { AdminCommittee } from '~~/shared/types/api'
import { AdminImageModal, ConfirmModal } from '#components'

definePageMeta({ layout: 'admin' })

const toast = useApiToast()
const overlay = useOverlay()
const confirmModal = overlay.create(ConfirmModal)
const imageModal = overlay.create(AdminImageModal)

const { data, refresh, status } = await useFetch<{ data: AdminCommittee[] }>(
  '/api/admin/committees'
)
const committees = computed(() => data.value?.data ?? [])

const columns: TableColumn<AdminCommittee>[] = [
  { id: 'cover', header: 'Portada' },
  { accessorKey: 'name', header: 'Nombre' },
  { accessorKey: 'slug', header: 'Slug (URL)' },
  { accessorKey: 'members', header: 'Miembros' },
  { accessorKey: 'votes', header: 'Votaciones' },
  { accessorKey: 'order', header: 'Orden' },
  {
    id: 'actions',
    meta: {
      class: {
        td: 'sticky right-0 bg-default border-l border-default',
        th: 'sticky right-0 bg-default border-l border-default',
      },
    },
  },
]

const schema = z.object({
  name: z.string().trim().min(1, 'Nombre obligatorio').max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/, 'Solo minúsculas, números y guiones')
    .max(60)
    .optional(),
  order: z.number().int().min(0).max(1000).optional(),
})
type Schema = z.output<typeof schema>

const isOpen = ref(false)
const editing = ref<AdminCommittee | null>(null)
const state = reactive<Partial<Schema>>({ name: '', slug: '', order: 0 })
const isSaving = ref(false)

function openCreate() {
  editing.value = null
  state.name = ''
  state.slug = ''
  state.order = committees.value.length + 1
  isOpen.value = true
}

function openEdit(committee: AdminCommittee) {
  editing.value = committee
  state.name = committee.name
  state.slug = committee.slug
  state.order = committee.order
  isOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSaving.value = true
  const body = { ...event.data, slug: event.data.slug || undefined }
  try {
    if (editing.value) {
      await $fetch(`/api/admin/committees/${editing.value.id}`, { method: 'PATCH', body })
      toast.success('Comisión actualizada')
    } else {
      await $fetch('/api/admin/committees', { method: 'POST', body })
      toast.success('Comisión creada')
    }
    isOpen.value = false
    await refresh()
  } catch (error) {
    toast.error(error)
  } finally {
    isSaving.value = false
  }
}

const COVER_HINT = 'Apaisada, mínimo 800 × 450 px. Se recorta a 16:9. JPG, PNG, WebP o AVIF.'

async function openCover(committee: AdminCommittee) {
  const changed = await imageModal.open({
    title: `Portada de ${committee.name}`,
    description: 'Cabecera de su página y de su tarjeta en la página de inicio.',
    currentUrl: committee.cover,
    uploadUrl: `/api/admin/committees/${committee.id}/cover`,
    deleteUrl: `/api/admin/committees/${committee.id}/cover`,
    shape: 'wide' as const,
    hint: COVER_HINT,
  }).result
  if (changed) await refresh()
}

// The plenary has no committees row, so its cover is a setting of its own.
const { data: plenaryData, refresh: refreshPlenary } = await useFetch<{
  data: { plenary: { cover: string | null } }
}>('/api/committees')
const plenaryCover = computed(() => plenaryData.value?.data.plenary.cover ?? null)

async function openPlenaryCover() {
  const changed = await imageModal.open({
    title: 'Portada del Pleno',
    description: 'El Pleno no es una comisión, pero se presenta igual en la web pública.',
    currentUrl: plenaryCover.value,
    uploadUrl: '/api/admin/plenary/cover',
    deleteUrl: '/api/admin/plenary/cover',
    shape: 'wide' as const,
    hint: COVER_HINT,
  }).result
  if (changed) await refreshPlenary()
}

async function remove(committee: AdminCommittee) {
  const confirmed = await confirmModal.open({
    title: `Eliminar ${committee.name}`,
    description:
      'Solo se puede eliminar si no tiene miembros, votaciones ni votos emitidos que la mencionen.',
    confirmLabel: 'Eliminar',
  }).result
  if (!confirmed) return
  try {
    await $fetch(`/api/admin/committees/${committee.id}`, { method: 'DELETE' })
    toast.success('Comisión eliminada')
    await refresh()
  } catch (error) {
    toast.error(error)
  }
}

useHead({ title: 'Comisiones' })
</script>

<template>
  <div class="animate-fade-slide-up space-y-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-muted text-sm">{{ committees.length }} comisiones</p>
      <UButton icon="i-lucide-plus" color="primary" @click="openCreate">Nueva comisión</UButton>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <UTable :data="committees" :columns="columns" :loading="status === 'pending'">
        <template #cover-cell="{ row }">
          <div class="w-24 overflow-hidden rounded-md">
            <CommitteeCover :cover="row.original.cover" />
          </div>
        </template>
        <template #name-cell="{ row }">
          <span class="text-highlighted font-medium">{{ row.original.name }}</span>
        </template>
        <template #slug-cell="{ row }">
          <NuxtLink
            :to="`/c/${row.original.slug}`"
            target="_blank"
            class="text-primary inline-block py-2 font-mono text-xs hover:underline"
          >
            /c/{{ row.original.slug }}
          </NuxtLink>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-2">
            <UButton
              icon="i-lucide-image"
              color="neutral"
              variant="ghost"
              size="md"
              aria-label="Portada"
              @click="openCover(row.original)"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="md"
              aria-label="Editar"
              @click="openEdit(row.original)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="md"
              aria-label="Eliminar"
              @click="remove(row.original)"
            />
          </div>
        </template>
      </UTable>

      <div class="border-default flex items-center gap-4 border-t p-4">
        <div class="w-24 shrink-0 overflow-hidden rounded-md">
          <CommitteeCover :cover="plenaryCover" plenary />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-highlighted flex items-center gap-1.5 font-medium">
            <UIcon name="i-lucide-star" class="text-eu-500 size-4" />
            Pleno
          </p>
          <p class="text-muted text-xs">No es una comisión: solo se le puede poner portada.</p>
        </div>
        <UButton
          icon="i-lucide-image"
          color="neutral"
          variant="ghost"
          size="md"
          aria-label="Portada del Pleno"
          @click="openPlenaryCover"
        />
      </div>
    </UCard>

    <UModal
      v-model:open="isOpen"
      :title="editing ? 'Editar comisión' : 'Nueva comisión'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="committee-form"
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField name="name" label="Nombre" required>
            <UInput v-model="state.name" placeholder="LIBE" class="w-full" />
          </UFormField>
          <UFormField
            name="slug"
            label="Slug para la URL"
            hint="Opcional"
            description="Si se deja vacío se genera a partir del nombre."
          >
            <UInput v-model="state.slug" placeholder="libe" class="w-full" />
          </UFormField>
          <UFormField name="order" label="Orden">
            <UInputNumber v-model="state.order" :min="0" class="w-full" />
          </UFormField>
        </UForm>
      </template>
      <template #footer="{ close }">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="close" />
        <UButton
          type="submit"
          form="committee-form"
          label="Guardar"
          color="primary"
          :loading="isSaving"
        />
      </template>
    </UModal>
  </div>
</template>
