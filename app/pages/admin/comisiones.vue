<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { AdminCommittee } from '~~/shared/types/api'
import { AdminImageModal, ConfirmModal } from '#components'
import { COMMITTEE_ICONS, DEFAULT_COMMITTEE_ICON, iconName } from '~~/shared/constants/icons'

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
  { id: 'drag', header: '' },
  { id: 'cover', header: 'Portada' },
  { accessorKey: 'name', header: 'Nombre' },
  { accessorKey: 'slug', header: 'Slug (URL)' },
  { accessorKey: 'members', header: 'Miembros' },
  { accessorKey: 'votes', header: 'Votaciones' },
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
  icon: z.string().nullable().optional(),
})
type Schema = z.output<typeof schema>

const isOpen = ref(false)
const editing = ref<AdminCommittee | null>(null)
const state = reactive<Partial<Schema>>({ name: '', slug: '', icon: null })
const isSaving = ref(false)

function openCreate() {
  editing.value = null
  state.name = ''
  state.slug = ''
  state.icon = null
  isOpen.value = true
}

function openEdit(committee: AdminCommittee) {
  editing.value = committee
  state.name = committee.name
  state.slug = committee.slug
  state.icon = committee.icon
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

// The plenary has no committees row, so its cover and its place are settings.
const { data: plenaryData, refresh: refreshPlenary } = await useFetch<{
  data: { plenary: { cover: string | null }; plenaryFirst: boolean }
}>('/api/committees')
const plenaryCover = computed(() => plenaryData.value?.data.plenary.cover ?? null)
const plenaryFirst = computed(() => plenaryData.value?.data.plenaryFirst ?? false)

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

/**
 * The plenary is not a comisión and has no place among them: it can only sit
 * above the whole list or below it. So it is dragged against the table as a
 * whole rather than against a row, and which half of the table it is dropped on
 * is the entire answer.
 */
const plenaryCard = useTemplateRef<HTMLElement>('plenaryCard')
const tableCard = useTemplateRef<HTMLElement>('tableCard')
const plenaryDragging = ref(false)
const plenaryDropSide = ref<'first' | 'last' | null>(null)
const isMovingPlenary = ref(false)

async function setPlenaryFirst(first: boolean) {
  if (first === plenaryFirst.value || isMovingPlenary.value) return
  isMovingPlenary.value = true
  const boxes = () => {
    const map = new Map<string, HTMLElement>()
    if (plenaryCard.value) map.set('plenary', plenaryCard.value)
    if (tableCard.value) map.set('committees', tableCard.value)
    return map
  }
  try {
    await animateFlip(boxes, async () => {
      await $fetch('/api/admin/plenary/position', { method: 'POST', body: { first } })
      await refreshPlenary()
    })
  } catch (error) {
    toast.error(error)
    await refreshPlenary()
  } finally {
    isMovingPlenary.value = false
  }
}

function onPlenaryDragStart(event: DragEvent) {
  plenaryDragging.value = true
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    // Firefox ignores a drag that carries no data.
    event.dataTransfer.setData('text/plain', 'pleno')
  }
  setRowDragImage(event, plenaryCard.value)
}

function onPlenaryDragEnd() {
  plenaryDragging.value = false
  plenaryDropSide.value = null
}

function onTableDragOver(event: DragEvent) {
  // A committee dragged over its own table is the other composable's business.
  if (!plenaryDragging.value || !tableCard.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const rect = tableCard.value.getBoundingClientRect()
  plenaryDropSide.value = event.clientY < rect.top + rect.height / 2 ? 'first' : 'last'
}

/** Only when the pointer leaves the table for good, not on its way between cells. */
function onTableDragLeave(event: DragEvent) {
  const to = event.relatedTarget as Node | null
  if (to && tableCard.value?.contains(to)) return
  plenaryDropSide.value = null
}

async function onTableDrop(event: DragEvent) {
  if (!plenaryDragging.value) return
  event.preventDefault()
  const side = plenaryDropSide.value
  onPlenaryDragEnd()
  if (side) await setPlenaryFirst(side === 'first')
}

const isReordering = ref(false)
const reorder = useDragReorder(
  () => committees.value.map((row) => row.id),
  async (ids) => {
    isReordering.value = true
    try {
      await $fetch('/api/admin/committees/reorder', { method: 'POST', body: { ids } })
      await refresh()
    } catch (error) {
      toast.error(error)
      await refresh()
    } finally {
      isReordering.value = false
    }
  }
)

useHead({ title: 'Comisiones' })
</script>

<template>
  <!--
    A flex column so the plenary can change ends without changing places in the
    markup: only its `order` moves, which is what lets the swap be animated.
  -->
  <div class="flex flex-col gap-4">
    <div class="order-1 flex items-center justify-between gap-3">
      <p class="text-muted text-sm">{{ committees.length }} comisiones</p>
      <UButton icon="i-lucide-plus" color="primary" @click="openCreate">Nueva comisión</UButton>
    </div>

    <div
      ref="tableCard"
      class="order-3"
      @dragover="onTableDragOver"
      @drop="onTableDrop"
      @dragleave="onTableDragLeave"
    >
      <UCard
        :ui="{ body: 'p-0 sm:p-0' }"
        :class="{
          'drop-before': plenaryDropSide === 'first',
          'drop-after': plenaryDropSide === 'last',
        }"
      >
        <UTable
          :data="committees"
          :columns="columns"
          :loading="status === 'pending' || isReordering"
          @dragover="reorder.onDragOver"
          @drop="reorder.onDrop"
        >
          <template #drag-cell="{ row }">
            <AdminReorderHandle
              :data-row-id="row.original.id"
              :label="row.original.name"
              :first="reorder.isFirst(row.original.id)"
              :last="reorder.isLast(row.original.id)"
              @dragstart="reorder.onDragStart(row.original.id, $event)"
              @dragend="reorder.onDragEnd"
              @up="reorder.move(row.original.id, -1)"
              @down="reorder.move(row.original.id, 1)"
            />
          </template>
          <template #cover-cell="{ row }">
            <div class="w-24 overflow-hidden rounded-md">
              <CommitteeCover :cover="row.original.cover" :icon="row.original.icon" />
            </div>
          </template>
          <template #name-cell="{ row }">
            <span class="text-highlighted inline-flex items-center gap-2 font-medium">
              <UIcon
                :name="iconName(row.original.icon, DEFAULT_COMMITTEE_ICON)"
                class="text-muted size-4 shrink-0"
              />
              {{ row.original.name }}
            </span>
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
      </UCard>
    </div>

    <!--
      Its own card, outside the sortable table. As a row it invited a drag it
      can never accept: it has no committees record, so there is no place among
      them for it to take. Dragged against the table as a whole, though, the two
      places it does have are exactly the two halves of it.
    -->
    <div ref="plenaryCard" :class="plenaryFirst ? 'order-2' : 'order-4'">
      <UCard :class="plenaryDragging ? 'dragging-row' : ''">
        <div class="flex items-center gap-3">
          <AdminReorderHandle
            label="Pleno"
            :disabled="isMovingPlenary"
            :first="plenaryFirst"
            :last="!plenaryFirst"
            @dragstart="onPlenaryDragStart"
            @dragend="onPlenaryDragEnd"
            @up="setPlenaryFirst(true)"
            @down="setPlenaryFirst(false)"
          />
          <div class="w-24 shrink-0 overflow-hidden rounded-md">
            <CommitteeCover :cover="plenaryCover" plenary />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-highlighted flex items-center gap-1.5 font-medium">
              <UIcon name="i-lucide-star" class="text-eu-500 size-4" />
              Pleno
            </p>
            <p class="text-muted text-xs">
              No es una comisión: solo puede ir antes o después de todas ellas, nunca en medio.
            </p>
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
    </div>

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
          <UFormField
            name="icon"
            label="Icono"
            description="Se usa donde no cabe la portada, como la etiqueta de comisión junto a una persona."
          >
            <AdminIconPicker
              v-model="state.icon"
              :icons="COMMITTEE_ICONS"
              :fallback="DEFAULT_COMMITTEE_ICON"
            />
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
