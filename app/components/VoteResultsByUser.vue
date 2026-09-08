<script setup lang="ts">
import type { PublicVoter, VoteOption, VoteResultsUser } from '~~/shared/types/api'
import { getContrastTextColor, getOptionDisplayColor } from '~~/shared/utils/votePresentation'

const props = withDefaults(
  defineProps<{
    options: VoteOption[]
    byUser: VoteResultsUser[]
    pendingUsers: PublicVoter[]
    resultsVisible: boolean
    showCommittee?: boolean
  }>(),
  { showCommittee: false }
)

const { formatTime } = useFormatting()

const search = ref('')
const optionFilter = ref<string>('all')
const groupFilter = ref<string>('all')

const optionById = computed(() => {
  const map = new Map<string, VoteOption & { displayColor: string }>()
  props.options.forEach((option, index) => {
    map.set(option.id, { ...option, displayColor: getOptionDisplayColor(option.color, index) })
  })
  return map
})

const optionItems = computed(() => [
  { label: 'Todas las opciones', value: 'all' },
  ...props.options.map((option) => ({ label: option.label, value: option.id })),
  { label: 'Pendientes de votar', value: 'pending' },
])

const groupItems = computed(() => {
  const groups = new Map<string, string>()
  for (const entry of [...props.byUser, ...props.pendingUsers]) {
    if (entry.group) groups.set(entry.group.id, entry.group.name)
  }
  return [
    { label: 'Todos los grupos', value: 'all' },
    ...[...groups.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es'))
      .map(([id, name]) => ({ label: name, value: id })),
  ]
})

type Row = PublicVoter & { optionId: string | null; votedAt: string | null; pending: boolean }

const rows = computed<Row[]>(() => {
  const voted: Row[] = props.byUser.map((entry) => ({ ...entry, pending: false }))
  const pending: Row[] = props.pendingUsers.map((entry) => ({
    ...entry,
    optionId: null,
    votedAt: null,
    pending: true,
  }))
  const term = search.value.trim().toLowerCase()

  return [...voted, ...pending].filter((row) => {
    if (term && !row.name.toLowerCase().includes(term)) return false
    if (groupFilter.value !== 'all' && row.group?.id !== groupFilter.value) return false
    if (optionFilter.value === 'pending') return row.pending
    if (optionFilter.value !== 'all') return row.optionId === optionFilter.value
    return true
  })
})

const groupedRows = computed(() => {
  const map = new Map<string, { group: PublicVoter['group']; rows: Row[] }>()
  for (const row of rows.value) {
    const key = row.group?.id ?? '__none__'
    if (!map.has(key)) map.set(key, { group: row.group, rows: [] })
    map.get(key)!.rows.push(row)
  }
  return [...map.values()].sort((a, b) => {
    if (!a.group) return 1
    if (!b.group) return -1
    return a.group.name.localeCompare(b.group.name, 'es')
  })
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-2 sm:flex-row">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Buscar por nombre"
        class="sm:flex-1"
      />
      <USelect v-model="groupFilter" :items="groupItems" class="sm:w-56" />
      <USelect v-if="resultsVisible" v-model="optionFilter" :items="optionItems" class="sm:w-56" />
    </div>

    <p v-if="rows.length === 0" class="text-muted py-6 text-center text-sm">Sin resultados.</p>

    <div v-for="section in groupedRows" :key="section.group?.id ?? 'none'">
      <div class="mb-2 flex items-center gap-2">
        <GroupBadge :group="section.group" />
        <span class="text-muted text-xs">
          {{ section.group?.name ?? 'Sin grupo' }} · {{ section.rows.length }}
        </span>
      </div>
      <ul class="border-default divide-default divide-y overflow-hidden rounded-lg border">
        <li
          v-for="row in section.rows"
          :key="row.id"
          class="flex items-center gap-3 px-3 py-2"
          :class="row.pending ? 'bg-muted/40' : 'bg-default'"
        >
          <UserAvatar :user="row" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium" :class="{ 'text-muted': row.pending }">
              {{ row.name }}
            </p>
            <p v-if="showCommittee && row.committee" class="text-muted truncate text-xs">
              {{ row.committee.name }}
            </p>
          </div>
          <span v-if="row.votedAt" class="text-muted hidden text-xs sm:inline">
            {{ formatTime(row.votedAt) }}
          </span>
          <template v-if="row.pending">
            <UBadge color="neutral" variant="subtle" size="sm">Pendiente</UBadge>
          </template>
          <template v-else-if="!resultsVisible || !row.optionId">
            <UBadge color="success" variant="subtle" size="sm" icon="i-lucide-check">
              Ha votado
            </UBadge>
          </template>
          <span
            v-else
            class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            :style="{
              backgroundColor: optionById.get(row.optionId)?.displayColor,
              color: getContrastTextColor(optionById.get(row.optionId)?.displayColor ?? '#000'),
            }"
          >
            {{ optionById.get(row.optionId)?.label ?? '—' }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
