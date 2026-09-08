<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AdminCommittee, AdminGroup, AdminUser } from '~~/shared/types/api'

const props = defineProps<{
  user: AdminUser | null
  committees: AdminCommittee[]
  groups: AdminGroup[]
}>()

const emit = defineEmits<{
  close: [
    result: {
      saved: boolean
      user?: AdminUser
      password?: string
      mailSent?: boolean
      mailRequested?: boolean
    },
  ]
}>()

const toast = useApiToast()

const schema = z
  .object({
    firstName: z.string().trim().min(1, 'Nombre obligatorio').max(100),
    lastName: z.string().trim().min(1, 'Apellidos obligatorios').max(150),
    email: z.email('Correo no válido'),
    role: z.enum(['admin', 'delegate']),
    committeeId: z.string().nullable(),
    groupId: z.string().nullable(),
    sendCredentials: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.role !== 'delegate') return
    if (!value.committeeId) {
      ctx.addIssue({
        code: 'custom',
        path: ['committeeId'],
        message: 'Obligatoria para participantes',
      })
    }
    if (!value.groupId) {
      ctx.addIssue({ code: 'custom', path: ['groupId'], message: 'Obligatorio para participantes' })
    }
  })
type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  firstName: props.user?.firstName ?? '',
  lastName: props.user?.lastName ?? '',
  email: props.user?.email ?? '',
  role: props.user?.role ?? 'delegate',
  committeeId: props.user?.committeeId ?? null,
  groupId: props.user?.groupId ?? null,
  sendCredentials: true,
})

const isSaving = ref(false)

const committeeItems = computed(() => [
  { label: 'Sin comisión', value: null },
  ...props.committees.map((committee) => ({ label: committee.name, value: committee.id })),
])
const groupItems = computed(() => [
  { label: 'Sin grupo', value: null },
  ...props.groups.map((group) => ({
    label: `${group.abbreviation} · ${group.name}`,
    value: group.id,
  })),
])
const roleItems = [
  { label: 'Participante', value: 'delegate' },
  { label: 'Administración', value: 'admin' },
]

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSaving.value = true
  try {
    if (props.user) {
      const { sendCredentials: _ignored, ...body } = event.data
      await $fetch(`/api/admin/users/${props.user.id}`, { method: 'PATCH', body })
      toast.success('Usuario actualizado')
      emit('close', { saved: true })
    } else {
      const response = await $fetch<{
        data: AdminUser
        meta: { mailSent: boolean; password?: string }
      }>('/api/admin/users', { method: 'POST', body: event.data })
      toast.success('Usuario creado')
      emit('close', {
        saved: true,
        password: response.meta.password,
        mailSent: response.meta.mailSent,
      })
    }
  } catch (error) {
    toast.error(error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal
    :title="user ? 'Editar usuario' : 'Nuevo usuario'"
    :description="user ? undefined : 'Se generará una contraseña aleatoria.'"
    :close="{ onClick: () => emit('close', { saved: false }) }"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <UForm id="user-form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField name="firstName" label="Nombre" required>
            <UInput v-model="state.firstName" class="w-full" />
          </UFormField>
          <UFormField name="lastName" label="Apellidos" required>
            <UInput v-model="state.lastName" class="w-full" />
          </UFormField>
        </div>
        <UFormField name="email" label="Correo electrónico" required>
          <UInput v-model="state.email" type="email" class="w-full" />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField name="committeeId" label="Comisión" :required="state.role === 'delegate'">
            <USelect v-model="state.committeeId" :items="committeeItems" class="w-full" />
          </UFormField>
          <UFormField
            name="groupId"
            label="Grupo parlamentario"
            :required="state.role === 'delegate'"
          >
            <USelect v-model="state.groupId" :items="groupItems" class="w-full" />
          </UFormField>
        </div>
        <UFormField name="role" label="Rol">
          <USelect v-model="state.role" :items="roleItems" class="w-full" />
        </UFormField>
        <UFormField v-if="!user" name="sendCredentials">
          <USwitch
            v-model="state.sendCredentials"
            label="Enviar credenciales por correo"
            description="Si no se envía, la contraseña se mostrará una sola vez al crear el usuario."
          />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton
        label="Cancelar"
        color="neutral"
        variant="outline"
        @click="emit('close', { saved: false })"
      />
      <UButton
        type="submit"
        form="user-form"
        :label="user ? 'Guardar' : 'Crear usuario'"
        color="primary"
        :loading="isSaving"
      />
    </template>
  </UModal>
</template>
