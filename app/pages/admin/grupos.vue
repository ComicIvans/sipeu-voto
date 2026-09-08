<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { AdminGroup } from '~~/shared/types/api'
import { AdminImageModal, ConfirmModal } from '#components'

definePageMeta({ layout: 'admin' })

const toast = useApiToast()
const overlay = useOverlay()
const confirmModal = overlay.create(ConfirmModal)
const imageModal = overlay.create(AdminImageModal)

const { data, refresh, status } = await useFetch<{ data: AdminGroup[] }>('/api/admin/groups')
const groups = computed(() => data.value?.data ?? [])

const columns: TableColumn<AdminGroup>[] = [
  { id: 'logo', header: 'Logo' },
  { accessorKey: 'abbreviation', header: 'Siglas' },
  { accessorKey: 'name', header: 'Nombre' },
  { accessorKey: 'members', header: 'Miembros' },
  { accessorKey: 'order', header: 'Orden' },
  { id: 'actions' },
]

const schema = z.object({
  name: z.string().trim().min(1, 'Nombre obligatorio').max(120),
  abbreviation: z.string().trim().min(1, 'Siglas obligatorias').max(12),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex (#RRGGBB)'),
  order: z.number().int().min(0).max(1000).optional(),
})
type Schema = z.output<typeof schema>

const isOpen = ref(false)
const editing = ref<AdminGroup | null>(null)
const state = reactive<Partial<Schema>>({ name: '', abbreviation: '', color: '#0048a0', order: 0 })
const isSaving = ref(false)

function openCreate() {
  editing.value = null
  Object.assign(state, {
    name: '',
    abbreviation: '',
    color: '#0048a0',
    order: groups.value.length + 1,
  })
  isOpen.value = true
}

function openEdit(group: AdminGroup) {
  editing.value = group
  Object.assign(state, {
    name: group.name,
    abbreviation: group.abbreviation,
    color: group.color,
    order: group.order,
  })
  isOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSaving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/admin/groups/${editing.value.id}`, { method: 'PATCH', body: event.data })
      toast.success('Grupo actualizado')
    } else {
      await $fetch('/api/admin/groups', { method: 'POST', body: event.data })
      toast.success('Grupo creado')
    }
    isOpen.value = false
    await refresh()
  } catch (error) {
    toast.error(error)
  } finally {
    isSaving.value = false
  }
}

async function openImage(group: AdminGroup) {
  const changed = await imageModal.open({
    title: `Logo de ${group.name}`,
    description: 'Se muestra junto al grupo en los resultados por grupo parlamentario.',
    currentUrl: group.logo,
    uploadUrl: `/api/admin/groups/${group.id}/logo`,
    deleteUrl: `/api/admin/groups/${group.id}/logo`,
    shape: 'square' as const,
    hint: 'PNG con fondo transparente, mínimo 64 px de lado. No se recorta.',
  }).result
  if (changed) await refresh()
}

async function remove(group: AdminGroup) {
  const confirmed = await confirmModal.open({
    title: `Eliminar ${group.name}`,
    description: 'Los miembros deben reasignarse antes de eliminar el grupo.',
    confirmLabel: 'Eliminar',
  }).result
  if (!confirmed) return
  try {
    await $fetch(`/api/admin/groups/${group.id}`, { method: 'DELETE' })
    toast.success('Grupo eliminado')
    await refresh()
  } catch (error) {
    toast.error(error)
  }
}

useHead({ title: 'Grupos parlamentarios' })
</script>

<template>
  <div class="animate-fade-slide-up space-y-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-muted text-sm">{{ groups.length }} grupos parlamentarios</p>
      <UButton icon="i-lucide-plus" color="primary" @click="openCreate">Nuevo grupo</UButton>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <UTable :data="groups" :columns="columns" :loading="status === 'pending'">
        <template #logo-cell="{ row }">
          <GroupLogo :group="row.original" size="md" />
        </template>
        <template #abbreviation-cell="{ row }">
          <GroupBadge :group="row.original" size="md" />
        </template>
        <template #name-cell="{ row }">
          <span class="text-highlighted font-medium">{{ row.original.name }}</span>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton
              icon="i-lucide-image"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Logo"
              @click="openImage(row.original)"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Editar"
              @click="openEdit(row.original)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              aria-label="Eliminar"
              @click="remove(row.original)"
            />
          </div>
        </template>
      </UTable>
    </UCard>

    <UModal
      v-model:open="isOpen"
      :title="editing ? 'Editar grupo' : 'Nuevo grupo parlamentario'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm id="group-form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField name="name" label="Nombre" required>
            <UInput v-model="state.name" placeholder="Alianza Popular Europea" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField name="abbreviation" label="Siglas" required>
              <UInput v-model="state.abbreviation" placeholder="APE" class="w-full" />
            </UFormField>
            <UFormField name="order" label="Orden">
              <UInputNumber v-model="state.order" :min="0" class="w-full" />
            </UFormField>
          </div>
          <UFormField name="color" label="Color" required>
            <div class="flex items-center gap-3">
              <input
                v-model="state.color"
                type="color"
                class="border-default size-10 cursor-pointer rounded-md border bg-transparent p-0.5"
                aria-label="Selector de color"
              />
              <UInput v-model="state.color" placeholder="#0048a0" class="flex-1 font-mono" />
              <GroupBadge
                :group="{
                  id: 'x',
                  name: state.name || 'Grupo',
                  abbreviation: state.abbreviation || 'ABC',
                  color: state.color || '#0048a0',
                  logo: null,
                }"
                size="md"
              />
            </div>
          </UFormField>
        </UForm>
      </template>
      <template #footer="{ close }">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="close" />
        <UButton
          type="submit"
          form="group-form"
          label="Guardar"
          color="primary"
          :loading="isSaving"
        />
      </template>
    </UModal>
  </div>
</template>
