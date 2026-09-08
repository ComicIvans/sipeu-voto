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

/**
 * `getOptionDisplayColor` resolves null to the palette colour for that position,
 * so clearing the field is what "back to the default" means. Without this there
 * was no way back: the colour input can only ever hand over a concrete colour.
 */
function resetColor(index: number) {
  update(index, { color: null })
}

function update(index: number, patch: Partial<EditableOption>) {
  options.value = options.value.map((option, i) => (i === index ? { ...option, ...patch } : option))
}

const meaningDisabled = computed(() => props.disabled || props.lockedMeaning)

/**
 * These rows are rendered here, so positions are known without going through the
 * DOM the way the admin tables have to. Nothing moves during the drag: the row
 * being dragged stays put, only dimmed, and the target gets a line on the edge
 * it would land on. The arrows do the same job without a pointer.
 */
const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)

function dropClass(index: number) {
  if (dragIndex.value === null || overIndex.value !== index || dragIndex.value === index) return ''
  return index > dragIndex.value ? 'drop-after' : 'drop-before'
}

function onDragStart(index: number, event: DragEvent) {
  if (props.disabled) return
  dragIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    // Firefox ignores a drag that carries no data.
    event.dataTransfer.setData('text/plain', String(index))
  }
  // The whole option rides under the pointer, not the grip icon alone.
  setRowDragImage(event, (event.target as HTMLElement | null)?.closest('li'))
}

function onDragOver(index: number, event: DragEvent) {
  if (dragIndex.value === null) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  overIndex.value = index
}

function onDragEnd() {
  dragIndex.value = null
  overIndex.value = null
}

function onDrop(index: number, event: DragEvent) {
  event.preventDefault()
  const from = dragIndex.value
  onDragEnd()
  if (from === null || from === index) return
  const next = [...options.value]
  const [item] = next.splice(from, 1)
  next.splice(index, 0, item!)
  options.value = next
}
</script>

<template>
  <div class="space-y-3">
    <ul v-if="options.length > 0" class="space-y-2">
      <li
        v-for="(option, index) in options"
        :key="option.id ?? `new-${index}`"
        class="border-default bg-default flex flex-wrap items-center gap-2 rounded-lg border p-2"
        :class="[dragIndex === index ? 'dragging-row' : '', dropClass(index)]"
        @dragover="onDragOver(index, $event)"
        @drop="onDrop(index, $event)"
      >
        <AdminReorderHandle
          :label="option.label || 'la opción'"
          :disabled="disabled"
          :first="index === 0"
          :last="index === options.length - 1"
          @dragstart="onDragStart(index, $event)"
          @dragend="onDragEnd"
          @up="move(index, -1)"
          @down="move(index, 1)"
        />
        <div class="flex items-center gap-1">
          <label class="relative">
            <span class="sr-only">Color de {{ option.label || 'la opción' }}</span>
            <input
              type="color"
              :value="getOptionDisplayColor(option.color, index)"
              :disabled="disabled"
              class="size-8 cursor-pointer rounded-md border-0 bg-transparent p-0"
              @input="update(index, { color: ($event.target as HTMLInputElement).value })"
            />
          </label>
          <UTooltip text="Volver al color por defecto">
            <UButton
              v-if="option.color !== null"
              icon="i-lucide-rotate-ccw"
              size="xs"
              color="neutral"
              variant="ghost"
              :disabled="disabled"
              :aria-label="`Restablecer el color de ${option.label || 'la opción'}`"
              @click="resetColor(index)"
            />
          </UTooltip>
        </div>
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
