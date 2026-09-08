<script setup lang="ts">
import type { VoteDetail } from '~~/shared/types/api'
import { getContrastTextColor, getOptionDisplayColor } from '~~/shared/utils/votePresentation'

const props = defineProps<{ vote: VoteDetail }>()
const emit = defineEmits<{ voted: [] }>()

const toast = useApiToast()
const { formatTime } = useFormatting()

const selectedOptionId = ref<string | null>(null)
const isSubmitting = ref(false)

const myOption = computed(() =>
  props.vote.myBallot
    ? (props.vote.options.find((option) => option.id === props.vote.myBallot?.optionId) ?? null)
    : null
)

const canSubmit = computed(() => {
  if (!props.vote.open) return false
  if (props.vote.myBallot && !props.vote.allowChange) return false
  return Boolean(selectedOptionId.value) && selectedOptionId.value !== props.vote.myBallot?.optionId
})

const locked = computed(() => Boolean(props.vote.myBallot) && !props.vote.allowChange)

watch(
  () => props.vote.myBallot?.optionId,
  (optionId) => {
    selectedOptionId.value = optionId ?? null
  },
  { immediate: true }
)

async function submit() {
  if (!canSubmit.value || !selectedOptionId.value) return
  isSubmitting.value = true
  try {
    await $fetch(`/api/me/votes/${props.vote.id}/ballot`, {
      method: 'POST',
      body: { optionId: selectedOptionId.value },
    })
    toast.success(props.vote.myBallot ? 'Voto actualizado' : 'Voto registrado')
    emit('voted')
  } catch (error) {
    if (isNetworkError(error)) {
      // The server may have stored the ballot before the answer got lost.
      toast.warning(
        'No se ha podido confirmar el voto',
        'Comprobando con el servidor si quedó registrado…'
      )
    } else {
      toast.error(error, 'No se ha podido registrar el voto.')
    }
    emit('voted')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div
    class="border-sipeu-200 bg-default dark:border-sipeu-800 h-fit rounded-2xl border-2 p-5 shadow-sm sm:p-6"
  >
    <div class="mb-4 flex items-center justify-between gap-2">
      <h2 class="text-highlighted text-lg font-semibold">
        {{ myOption ? 'Tu voto' : 'Emite tu voto' }}
      </h2>
      <UBadge v-if="myOption" color="success" variant="subtle" icon="i-lucide-check">
        Registrado {{ vote.myBallot ? formatTime(vote.myBallot.updatedAt) : '' }}
      </UBadge>
    </div>

    <p v-if="locked" class="text-muted mb-4 text-sm">
      Has votado
      <span class="text-highlighted font-semibold">{{ myOption?.label }}</span
      >. Esta votación no permite cambiar el voto.
    </p>
    <p v-else-if="myOption" class="text-muted mb-4 text-sm">
      Has votado <span class="text-highlighted font-semibold">{{ myOption.label }}</span
      >. Puedes cambiarlo mientras la votación siga abierta.
    </p>
    <p v-else class="text-muted mb-4 text-sm">
      Elige una opción y confirma. El voto es público: aparecerá tu nombre junto a la opción.
      <span v-if="!vote.allowChange" class="text-highlighted font-medium">
        No se podrá cambiar después de confirmar.
      </span>
    </p>

    <div role="radiogroup" aria-label="Opciones de voto" class="space-y-2">
      <button
        v-for="(option, index) in vote.options"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="selectedOptionId === option.id"
        :disabled="locked || isSubmitting"
        class="flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed"
        :class="
          selectedOptionId === option.id
            ? 'border-transparent shadow-md'
            : 'border-default bg-default hover:bg-muted/60 disabled:opacity-60'
        "
        :style="
          selectedOptionId === option.id
            ? {
                backgroundColor: getOptionDisplayColor(option.color, index),
                color: getContrastTextColor(getOptionDisplayColor(option.color, index)),
              }
            : undefined
        "
        @click="selectedOptionId = option.id"
      >
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-full border-2"
          :class="selectedOptionId === option.id ? 'border-current' : 'border-default'"
        >
          <UIcon v-if="selectedOptionId === option.id" name="i-lucide-check" class="size-4" />
          <span
            v-else
            class="size-3 rounded-full"
            :style="{ backgroundColor: getOptionDisplayColor(option.color, index) }"
          />
        </span>
        <span class="text-base font-semibold break-words">{{ option.label }}</span>
        <span v-if="!option.canWin" class="ml-auto text-xs opacity-75">no puede ganar</span>
      </button>
    </div>

    <UButton
      v-if="!locked"
      block
      size="lg"
      color="primary"
      class="mt-4"
      icon="i-lucide-vote"
      :loading="isSubmitting"
      :disabled="!canSubmit"
      @click="submit"
    >
      {{ myOption ? 'Cambiar voto' : 'Confirmar voto' }}
    </UButton>
  </div>
</template>
