<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AdminCommittee, VoteSummary } from '~~/shared/types/api'
import type { EditableOption } from '~/components/admin/VoteOptionsEditor.vue'

const props = defineProps<{
  vote: VoteSummary | null
  committees: AdminCommittee[]
  defaultCommitteeId?: string | null
}>()

const emit = defineEmits<{ close: [result: { saved: boolean; id?: string }] }>()

const toast = useApiToast()

/**
 * `datetime-local` speaks the reader's own clock, which is the same clock every
 * date in the app is shown on, so what an admin types is what they see.
 */
function toLocalInput(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const schema = z
  .object({
    name: z.string().trim().min(1, 'Nombre obligatorio').max(200),
    description: z.string().trim().max(2000).optional(),
    committeeId: z.string().nullable(),
    allowChange: z.boolean(),
    showLiveResults: z.boolean(),
    visible: z.boolean(),
    minimumVotes: z.number().int().positive().nullable().optional(),
    maxWinners: z.number().int().positive().nullable().optional(),
    opensAt: z.string().optional(),
    closesAt: z.string().optional(),
  })
  // Both strings are `YYYY-MM-DDTHH:mm`, so comparing them as text orders them.
  .refine((value) => !value.opensAt || !value.closesAt || value.closesAt > value.opensAt, {
    message: 'El cierre debe ser posterior a la apertura.',
    path: ['closesAt'],
  })
type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  name: props.vote?.name ?? '',
  description: props.vote?.description ?? '',
  committeeId: props.vote ? props.vote.committeeId : (props.defaultCommitteeId ?? null),
  allowChange: props.vote?.allowChange ?? false,
  showLiveResults: props.vote?.showLiveResults ?? true,
  visible: props.vote?.visible ?? true,
  minimumVotes: props.vote?.minimumVotes ?? null,
  maxWinners: props.vote?.maxWinners ?? null,
  opensAt: toLocalInput(props.vote?.opensAt),
  closesAt: toLocalInput(props.vote?.closesAt),
})

const options = ref<EditableOption[]>(
  props.vote
    ? props.vote.options.map((option) => ({
        id: option.id,
        label: option.label,
        color: option.color,
        canWin: option.canWin,
      }))
    : [
        { label: 'A favor', color: null, canWin: true, draftKey: 'draft-favor' },
        { label: 'En contra', color: null, canWin: true, draftKey: 'draft-contra' },
        { label: 'Abstención', color: null, canWin: false, draftKey: 'draft-abstencion' },
      ]
)

const isSaving = ref(false)

const locked = computed(() => Boolean(props.vote?.locked))
const isOpen = computed(() => Boolean(props.vote?.open))

const committeeItems = computed(() => [
  { label: 'Pleno (todas las comisiones)', value: null },
  ...props.committees.map((committee) => ({ label: committee.name, value: committee.id })),
])

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!props.vote && options.value.length === 0) {
    toast.error(null, 'Añade al menos una opción de voto.')
    return
  }
  isSaving.value = true
  try {
    const body = {
      ...event.data,
      description: event.data.description || null,
      minimumVotes: event.data.minimumVotes ?? null,
      maxWinners: event.data.maxWinners ?? null,
      opensAt: fromLocalInput(event.data.opensAt),
      closesAt: fromLocalInput(event.data.closesAt),
    }
    if (props.vote) {
      // Locked conditions are stripped so an unchanged value never trips the server guard.
      const { committeeId, allowChange, minimumVotes, maxWinners, ...editable } = body
      const patch = locked.value
        ? editable
        : { ...editable, committeeId, allowChange, minimumVotes, maxWinners }
      await $fetch(`/api/admin/votes/${props.vote.id}`, { method: 'PATCH', body: patch })
      toast.success('Votación actualizada')
      emit('close', { saved: true, id: props.vote.id })
    } else {
      const response = await $fetch<{ data: { id: string } }>('/api/admin/votes', {
        method: 'POST',
        body: {
          ...body,
          options: options.value.map((o) => ({ label: o.label, color: o.color, canWin: o.canWin })),
        },
      })
      toast.success('Votación creada')
      emit('close', { saved: true, id: response.data.id })
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
    :title="vote ? 'Editar votación' : 'Nueva votación'"
    :close="{ onClick: () => emit('close', { saved: false }) }"
    :ui="{ footer: 'justify-end', content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <UForm id="vote-form" :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
        <UAlert
          v-if="locked"
          color="neutral"
          variant="subtle"
          icon="i-lucide-lock"
          :title="
            isOpen
              ? 'Votación abierta: algunos campos están bloqueados'
              : 'Ya tiene votos: algunos campos están bloqueados'
          "
          :description="
            isOpen
              ? 'No se pueden cambiar el ámbito ni las reglas, ni ocultarla de la web pública, mientras siga abierta.'
              : 'El ámbito y las reglas definen lo que significan los votos ya emitidos. Para repetirla con otras condiciones, duplícala.'
          "
        />
        <UFormField name="name" label="Nombre" required>
          <UInput
            v-model="state.name"
            placeholder="Enmienda 3 a la resolución sobre…"
            class="w-full"
          />
        </UFormField>
        <UFormField name="committeeId" label="Ámbito" required>
          <USelect
            v-model="state.committeeId"
            :items="committeeItems"
            class="w-full"
            :disabled="locked"
          />
        </UFormField>
        <UFormField name="description" label="Descripción" hint="Opcional">
          <UTextarea v-model="state.description" :rows="2" autoresize class="w-full" />
        </UFormField>

        <div v-if="!vote">
          <p class="mb-2 text-sm font-medium">Opciones de voto</p>
          <AdminVoteOptionsEditor v-model="options" />
        </div>
        <p v-else class="text-muted text-xs">
          Las opciones se editan desde la página de la votación.
        </p>

        <div class="border-default grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
          <UFormField name="allowChange">
            <USwitch
              v-model="state.allowChange"
              label="Permitir cambiar el voto"
              description="Mientras siga abierta."
              :disabled="locked"
            />
          </UFormField>
          <UFormField name="showLiveResults">
            <USwitch
              v-model="state.showLiveResults"
              label="Recuento en directo"
              description="Si se desactiva, el resultado se muestra solo al cerrar."
            />
          </UFormField>
          <UFormField name="visible">
            <USwitch
              v-model="state.visible"
              label="Visible en la web pública"
              :description="isOpen ? 'No se puede ocultar mientras está abierta.' : undefined"
              :disabled="isOpen"
            />
          </UFormField>
        </div>

        <div class="border-default rounded-lg border p-3">
          <p class="mb-1 text-sm font-medium">Programación</p>
          <p class="text-muted mb-3 text-xs">
            Opcional. Los botones de abrir y cerrar siguen mandando: si la abres o la cierras a
            mano, la hora que ya haya pasado se descarta. Las horas son las de tu dispositivo.
          </p>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField name="opensAt" label="Se abre" hint="Opcional">
              <UInput v-model="state.opensAt" type="datetime-local" class="w-full" />
            </UFormField>
            <UFormField name="closesAt" label="Se cierra" hint="Opcional">
              <UInput v-model="state.closesAt" type="datetime-local" class="w-full" />
            </UFormField>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            name="minimumVotes"
            label="Mayoría mínima"
            hint="Opcional"
            description="Votos necesarios para que una opción gane."
          >
            <UInputNumber
              v-model="state.minimumVotes"
              :min="1"
              placeholder="Sin mínimo"
              class="w-full"
              :disabled="locked"
            />
          </UFormField>
          <UFormField
            name="maxWinners"
            label="Máximo de ganadoras"
            hint="Opcional"
            description="Útil solo para elegir varias candidaturas."
          >
            <UInputNumber
              v-model="state.maxWinners"
              :min="1"
              placeholder="Sin límite"
              class="w-full"
              :disabled="locked"
            />
          </UFormField>
        </div>
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
        form="vote-form"
        :label="vote ? 'Guardar' : 'Crear votación'"
        color="primary"
        :loading="isSaving"
      />
    </template>
  </UModal>
</template>
