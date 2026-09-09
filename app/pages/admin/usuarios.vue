<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { AdminCommittee, AdminGroup, AdminUser } from '~~/shared/types/api'
import {
  ConfirmModal,
  AdminUserFormModal,
  AdminImportUsersModal,
  AdminPasswordResultsModal,
  AdminAvatarPreviewModal,
  AdminImageModal,
} from '#components'
import type { PasswordResult } from '~/components/admin/PasswordResultsModal.vue'

definePageMeta({ layout: 'admin' })

const toast = useApiToast()
const overlay = useOverlay()
const route = useRoute()
const { user: me } = useAuth()

const confirmModal = overlay.create(ConfirmModal)
const userFormModal = overlay.create(AdminUserFormModal)
const importModal = overlay.create(AdminImportUsersModal)
const passwordResultsModal = overlay.create(AdminPasswordResultsModal)
const avatarPreviewModal = overlay.create(AdminAvatarPreviewModal)
const imageModal = overlay.create(AdminImageModal)

const {
  data: usersData,
  refresh,
  status,
} = await useFetch<{ data: AdminUser[] }>('/api/admin/users')
const { data: committeesData } = await useFetch<{ data: AdminCommittee[] }>('/api/admin/committees')
const { data: groupsData } = await useFetch<{ data: AdminGroup[] }>('/api/admin/groups')

const users = computed(() => usersData.value?.data ?? [])
const committees = computed(() => committeesData.value?.data ?? [])
const groups = computed(() => groupsData.value?.data ?? [])

useLiveRefresh(refresh, (event) => event.type === 'content-changed' && event.scope === 'users')

// ─── Filters ─────────────────────────────────────────────────────────────────
const search = ref('')
const committeeFilter = ref<string>('all')
const groupFilter = ref<string>('all')
const statusFilter = ref<string>('all')

const committeeItems = computed(() => [
  { label: 'Todas las comisiones', value: 'all' },
  { label: 'Sin comisión', value: 'none' },
  ...committees.value.map((c) => ({ label: c.name, value: c.id })),
])
const groupItems = computed(() => [
  { label: 'Todos los grupos', value: 'all' },
  { label: 'Sin grupo', value: 'none' },
  ...groups.value.map((g) => ({ label: g.abbreviation, value: g.id })),
])
const statusItems = [
  { label: 'Todos', value: 'all' },
  { label: 'Activos', value: 'active' },
  { label: 'Suspendidos', value: 'suspended' },
  { label: 'Administración', value: 'admin' },
  { label: 'Con foto', value: 'photo' },
  { label: 'Incompletos (sin comisión o grupo)', value: 'incomplete' },
]

const filteredUsers = computed(() => {
  const term = search.value.trim().toLowerCase()
  return users.value.filter((user) => {
    if (term && !`${user.name} ${user.email}`.toLowerCase().includes(term)) return false
    if (committeeFilter.value === 'none' && user.committeeId) return false
    if (
      committeeFilter.value !== 'all' &&
      committeeFilter.value !== 'none' &&
      user.committeeId !== committeeFilter.value
    )
      return false
    if (groupFilter.value === 'none' && user.groupId) return false
    if (
      groupFilter.value !== 'all' &&
      groupFilter.value !== 'none' &&
      user.groupId !== groupFilter.value
    )
      return false
    if (statusFilter.value === 'active' && user.banned) return false
    if (statusFilter.value === 'suspended' && !user.banned) return false
    if (statusFilter.value === 'admin' && user.role !== 'admin') return false
    if (statusFilter.value === 'photo' && !user.image) return false
    if (
      statusFilter.value === 'incomplete' &&
      !(user.role === 'delegate' && (!user.committeeId || !user.groupId))
    ) {
      return false
    }
    return true
  })
})

// ─── Table ───────────────────────────────────────────────────────────────────
const UCheckbox = resolveComponent('UCheckbox')
const rowSelection = ref<Record<string, boolean>>({})

const columns: TableColumn<AdminUser>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'aria-label': 'Seleccionar todos',
        size: 'xl',
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'aria-label': 'Seleccionar fila',
        size: 'xl',
      }),
  },
  { accessorKey: 'name', header: 'Usuario' },
  { accessorKey: 'committee', header: 'Comisión' },
  { accessorKey: 'group', header: 'Grupo' },
  { accessorKey: 'role', header: 'Rol' },
  { accessorKey: 'banned', header: 'Estado' },
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

const selectedUsers = computed<AdminUser[]>(() =>
  filteredUsers.value.filter((user) => rowSelection.value[user.id])
)

// ─── Actions ─────────────────────────────────────────────────────────────────
async function openCreate() {
  const result = await userFormModal.open({
    user: null,
    committees: committees.value,
    groups: groups.value,
  }).result
  if (result.saved) {
    await refresh()
    if (result.user && (result.password || result.mailRequested)) {
      passwordResultsModal.open({
        title: 'Usuario creado',
        results: [
          {
            name: result.user.name,
            email: result.user.email,
            updated: true,
            sent: Boolean(result.mailSent),
            password: result.password,
            error:
              result.mailRequested && !result.mailSent
                ? 'No se ha podido enviar el correo.'
                : undefined,
          },
        ],
      })
    }
  }
}

async function openEdit(user: AdminUser) {
  const result = await userFormModal.open({
    user,
    committees: committees.value,
    groups: groups.value,
  }).result
  if (result.saved) await refresh()
}

async function openImport() {
  const result = await importModal.open({}).result
  if (result.imported > 0) {
    await refresh()
    if (result.created?.length) {
      passwordResultsModal.open({
        title: `${result.imported} usuarios importados`,
        results: result.created,
      })
    }
  }
}

async function resetPasswords(targets: AdminUser[]) {
  if (targets.length === 0) return
  const confirmed = await confirmModal.open({
    title:
      targets.length === 1
        ? `Nueva contraseña para ${targets[0]!.name}`
        : `Nueva contraseña para ${targets.length} usuarios`,
    description:
      'Se generará una contraseña aleatoria y se enviará por correo. La contraseña actual dejará de funcionar y se cerrarán sus sesiones.',
    confirmLabel: 'Generar y enviar',
    color: 'primary',
  }).result
  if (!confirmed) return

  try {
    const response = await $fetch<{
      data: PasswordResult[]
      meta: { total: number; sent: number }
    }>('/api/admin/users/reset-password', {
      method: 'POST',
      body: { ids: targets.map((user) => user.id) },
    })
    rowSelection.value = {}
    passwordResultsModal.open({
      title: `Contraseñas generadas (${response.meta.sent}/${response.meta.total} enviadas)`,
      results: response.data,
    })
  } catch (error) {
    toast.error(error)
  }
}

async function toggleSuspend(user: AdminUser) {
  const action = user.banned ? 'reactivate' : 'suspend'
  if (!user.banned) {
    const confirmed = await confirmModal.open({
      title: `Suspender a ${user.name}`,
      description:
        'Perderá el acceso y el derecho a voto de inmediato. Sus votos ya emitidos se conservan.',
      confirmLabel: 'Suspender',
    }).result
    if (!confirmed) return
  }
  try {
    await $fetch(`/api/admin/users/${user.id}/${action}`, { method: 'POST' })
    toast.success(user.banned ? 'Cuenta reactivada' : 'Cuenta suspendida')
    await refresh()
  } catch (error) {
    toast.error(error)
  }
}

async function previewPhoto(user: AdminUser) {
  if (!user.image) return
  const action = await avatarPreviewModal.open({ name: user.name, image: user.image }).result
  if (action === 'remove') await removePhoto(user)
}

async function removePhoto(user: AdminUser) {
  try {
    await $fetch(`/api/admin/users/${user.id}/avatar`, { method: 'DELETE' })
    toast.success('Foto retirada')
    await refresh()
  } catch (error) {
    toast.error(error)
  }
}

async function openPhoto(user: AdminUser) {
  const changed = await imageModal.open({
    title: `Foto de ${user.name}`,
    description:
      'Se muestra junto a su nombre en las listas y en los resultados. Al quitarla se le pedirá que suba una foto de su cara.',
    currentUrl: user.image,
    uploadUrl: `/api/admin/users/${user.id}/avatar`,
    deleteUrl: `/api/admin/users/${user.id}/avatar`,
    shape: 'face' as const,
    hint: 'Su cara, mínimo 64 px de lado. Se recorta a un cuadrado. PNG, WebP, AVIF o JPG.',
  }).result
  if (changed) await refresh()
}

async function removeUser(user: AdminUser) {
  const confirmed = await confirmModal.open({
    title: `Eliminar a ${user.name}`,
    description: 'Se borrará la cuenta y todos sus votos. Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
  }).result
  if (!confirmed) return
  try {
    await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    toast.success('Usuario eliminado')
    await refresh()
  } catch (error) {
    toast.error(error)
  }
}

function rowActions(user: AdminUser) {
  return [
    [
      { label: 'Editar', icon: 'i-lucide-pencil', onSelect: () => openEdit(user) },
      {
        label: 'Restablecer contraseña',
        icon: 'i-lucide-key-round',
        onSelect: () => resetPasswords([user]),
      },
    ],
    [
      { label: 'Foto de perfil', icon: 'i-lucide-image-plus', onSelect: () => openPhoto(user) },
      ...(user.id !== me.value?.id
        ? [
            {
              label: user.banned ? 'Reactivar cuenta' : 'Suspender cuenta',
              icon: user.banned ? 'i-lucide-user-check' : 'i-lucide-user-x',
              onSelect: () => toggleSuspend(user),
            },
          ]
        : []),
    ],
    ...(user.id !== me.value?.id
      ? [
          [
            {
              label: 'Eliminar',
              icon: 'i-lucide-trash-2',
              color: 'error' as const,
              onSelect: () => removeUser(user),
            },
          ],
        ]
      : []),
  ]
}

onMounted(() => {
  if (route.query.importar) void openImport()
  if (route.query.filtro === 'incompletos') statusFilter.value = 'incomplete'
})

useHead({ title: 'Usuarios' })
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-muted text-sm">
        {{ filteredUsers.length }} de {{ users.length }} usuarios
        <span v-if="selectedUsers.length > 0" class="text-highlighted font-medium">
          · {{ selectedUsers.length }} seleccionados
        </span>
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="selectedUsers.length > 0"
          icon="i-lucide-key-round"
          color="neutral"
          variant="subtle"
          @click="resetPasswords(selectedUsers)"
        >
          Restablecer contraseña ({{ selectedUsers.length }})
        </UButton>
        <UButton
          icon="i-lucide-file-spreadsheet"
          color="neutral"
          variant="subtle"
          @click="openImport"
        >
          Importar CSV
        </UButton>
        <UButton icon="i-lucide-plus" color="primary" @click="openCreate">Nuevo usuario</UButton>
      </div>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="border-default flex flex-col gap-2 border-b p-3 sm:flex-row">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Buscar por nombre o correo"
          class="sm:flex-1"
        />
        <USelect v-model="committeeFilter" :items="committeeItems" class="sm:w-44" />
        <USelect v-model="groupFilter" :items="groupItems" class="sm:w-40" />
        <USelect v-model="statusFilter" :items="statusItems" class="sm:w-40" />
      </div>

      <UTable
        v-model:row-selection="rowSelection"
        :data="filteredUsers"
        :columns="columns"
        :loading="status === 'pending'"
        :get-row-id="(row: AdminUser) => row.id"
      >
        <template #name-cell="{ row }">
          <div class="flex items-center gap-3">
            <button
              v-if="row.original.image"
              type="button"
              class="focus-visible:ring-primary rounded-full focus-visible:ring-2 focus-visible:outline-none"
              :aria-label="`Ver foto de ${row.original.name}`"
              title="Ver foto"
              @click="previewPhoto(row.original)"
            >
              <UserAvatar :user="row.original" size="md" />
            </button>
            <UserAvatar v-else :user="row.original" size="md" />
            <div class="min-w-0">
              <p
                class="text-highlighted truncate font-medium"
                :class="{ 'line-through opacity-60': row.original.banned }"
              >
                {{ row.original.name }}
              </p>
              <p class="text-muted truncate text-xs">{{ row.original.email }}</p>
            </div>
          </div>
        </template>
        <template #committee-cell="{ row }">
          <span v-if="row.original.committee">{{ row.original.committee.name }}</span>
          <span v-else class="text-muted text-xs">—</span>
        </template>
        <template #group-cell="{ row }">
          <GroupBadge :group="row.original.group" />
        </template>
        <template #role-cell="{ row }">
          <UBadge
            :color="row.original.role === 'admin' ? 'primary' : 'neutral'"
            variant="subtle"
            size="sm"
          >
            {{ row.original.role === 'admin' ? 'Admin' : 'Participante' }}
          </UBadge>
        </template>
        <template #banned-cell="{ row }">
          <UBadge :color="row.original.banned ? 'error' : 'success'" variant="subtle" size="sm">
            {{ row.original.banned ? 'Suspendido' : 'Activo' }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end">
            <UDropdownMenu :items="rowActions(row.original)">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                size="md"
                aria-label="Acciones"
              />
            </UDropdownMenu>
          </div>
        </template>
        <template #empty>
          <div class="text-muted py-10 text-center text-sm">No hay usuarios que coincidan.</div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
