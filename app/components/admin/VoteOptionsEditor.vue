<script setup lang="ts">
import { SUGGESTED_OPTION_LABELS } from '~~/shared/constants/voteOptions'
import { getOptionDisplayColor } from '~~/shared/utils/votePresentation'

export interface EditableOption {
  id?: string
  label: string
  color: string | null
  canWin: boolean
}

const options = defineModel<EditableOption[]>({ required: true })

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    /** Ballots exist: only colour and order may change. */
    lockedMeaning?: boolean
  }>(),
  { disabled: false, lockedMeaning: false }
)

const newLabel = ref('')

const suggestions = computed(() => {
  const existing = new Set(options.value.map((option) => option.label.toLowerCase()))
  return SUGGESTED_OPTION_LABELS.map((pair) => pair[0]).filter(
    (label) => !existing.has(label.toLowerCase())
  )
})

function isAbstention(label: string) {
  return /abstenci|blanco/i.test(label)
}

function addOption(label = newLabel.value) {
  const trimmed = label.trim()
  if (!trimmed) return
  options.value = [
    ...options.value,
    { label: trimmed, color: null, canWin: !isAbstention(trimmed) },
  ]
  newLabel.value = ''
}

function addStandardSet() {
  for (const pair of SUGGESTED_OPTION_LABELS) addOption(pair[0])
}

function removeOption(index: number) {
  options.value = options.value.filter((_, i) => i !== index)
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= options.value.length) return
  const next = [...options.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  options.value = next
}

function update(index: number, patch: Partial<EditableOption>) {
  options.value = options.value.map((option, i) => (i === index ? { ...option, ...patch } : option))
}

const meaningDisabled = computed(() => props.disabled || props.lockedMeaning)
</script>

<template>
  <div class="space-y-3">
    <ul v-if="options.length > 0" class="space-y-2">
      <li
        v-for="(option, index) in options"
        :key="option.id ?? `new-${index}`"
        class="border-default bg-default flex flex-wrap items-center gap-2 rounded-lg border p-2"
      >
        <div class="flex flex-col">
          <UButton
            icon="i-lucide-chevron-up"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="disabled || index === 0"
            aria-label="Subir"
            @click="move(index, -1)"
          />
          <UButton
            icon="i-lucide-chevron-down"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="disabled || index === options.length - 1"
            aria-label="Bajar"
            @click="move(index, 1)"
          />
        </div>
        <label class="relative">
          <span class="sr-only">Color</span>
          <input
            type="color"
            :value="getOptionDisplayColor(option.color, index)"
            :disabled="disabled"
            class="size-8 cursor-pointer rounded-md border-0 bg-transparent p-0"
            @input="update(index, { color: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <UInput
          :model-value="option.label"
          :disabled="meaningDisabled"
          class="min-w-40 flex-1"
          placeholder="Etiqueta"
          @update:model-value="update(index, { label: String($event) })"
        />
        <UTooltip
          text="Si está desactivado, sus votos cuentan en el total y la participación, pero la opción nunca resulta ganadora (típico para la abstención)."
        >
          <USwitch
            :model-value="option.canWin"
            :disabled="meaningDisabled"
            size="sm"
            label="Puede ganar"
            @update:model-value="update(index, { canWin: Boolean($event) })"
          />
        </UTooltip>
        <UButton
          icon="i-lucide-trash-2"
          size="sm"
          color="error"
          variant="ghost"
          :disabled="meaningDisabled"
          aria-label="Eliminar opción"
          @click="removeOption(index)"
        />
      </li>
    </ul>
    <p v-else class="text-muted text-sm">Añade al menos una opción de voto.</p>

    <template v-if="!meaningDisabled">
      <div class="flex gap-2">
        <UInput
          v-model="newLabel"
          placeholder="Nueva opción"
          class="flex-1"
          @keydown.enter.prevent="addOption()"
        />
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          :disabled="!newLabel.trim()"
          @click="addOption()"
        >
          Añadir
        </UButton>
      </div>

      <div class="flex flex-wrap items-center gap-1.5 text-xs">
        <span class="text-muted">Sugerencias:</span>
        <UButton
          v-for="label in suggestions"
          :key="label"
          size="xs"
          color="neutral"
          variant="outline"
          @click="addOption(label)"
        >
          {{ label }}
        </UButton>
        <UButton
          v-if="suggestions.length > 0"
          size="xs"
          color="primary"
          variant="soft"
          icon="i-lucide-sparkles"
          @click="addStandardSet"
        >
          A favor / En contra / Abstención
        </UButton>
      </div>
    </template>
  </div>
</template>
