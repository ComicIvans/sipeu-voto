<script setup lang="ts">
import type { CommitteeListItem, OpenVoteItem } from '~~/shared/types/api'

const { user } = useAuth()

const {
  data: committeesData,
  refresh: refreshCommittees,
  error: committeesError,
  status: committeesStatus,
} = await useFetch<{
  data: { committees: CommitteeListItem[]; plenary: CommitteeListItem; plenaryFirst: boolean }
}>('/api/committees')

const { data: openData, refresh: refreshOpen } = await useFetch<{ data: OpenVoteItem[] }>(
  '/api/votes/open'
)

const committees = computed(() => committeesData.value?.data.committees ?? [])
const openVotes = computed(() => openData.value?.data ?? [])

/**
 * The plenary is not a committee, so it is not in the ordered list: it only
 * gets to be at one end or the other, and a setting says which.
 */
const cards = computed(() => {
  const list = committees.value.map((committee) => ({ committee, plenary: false }))
  const plenary = committeesData.value?.data.plenary
  if (!plenary) return list
  const card = { committee: plenary, plenary: true }
  return committeesData.value?.data.plenaryFirst ? [card, ...list] : [...list, card]
})

useLiveRefresh(() => Promise.all([refreshCommittees(), refreshOpen()]))

useHead({ title: 'Inicio' })
</script>

<template>
  <div>
    <section class="eu-hero text-white">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div class="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div class="max-w-2xl">
            <p class="text-eu-300 text-xs font-semibold tracking-widest uppercase">
              Simulación del Parlamento Europeo en Canarias
            </p>
            <h1 class="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Votaciones SIPEU</h1>
            <p class="mt-4 text-base text-white/85 sm:text-lg">
              Consulta las votaciones de cada comisión y del pleno, sigue el recuento en directo y
              revisa el resultado por grupo parlamentario y por persona.
            </p>
            <div class="mt-6 flex flex-wrap gap-3">
              <UButton
                v-if="user"
                to="/votar"
                size="lg"
                icon="i-lucide-vote"
                class="bg-eu-400 text-eu-950 hover:bg-eu-300"
              >
                Ir a votar
              </UButton>
              <UButton
                v-else
                to="/login"
                size="lg"
                icon="i-lucide-log-in"
                class="bg-eu-400 text-eu-950 hover:bg-eu-300"
              >
                Acceder para votar
              </UButton>
            </div>
          </div>
          <img
            src="/brand/sipeu-white.png"
            alt=""
            class="hidden w-56 opacity-95 drop-shadow-lg lg:block"
          />
        </div>
      </div>
      <div class="eu-stars h-2 w-full" aria-hidden="true" />
    </section>

    <UContainer class="py-8 sm:py-12">
      <section v-if="openVotes.length > 0" class="animate-fade-slide-up mb-10">
        <h2 class="text-highlighted mb-3 text-lg font-semibold">Votaciones en curso</h2>
        <OpenVotesBanner :votes="openVotes" />
      </section>

      <section class="animate-fade-slide-up">
        <h2 class="text-highlighted mb-4 text-2xl font-bold">Comisiones</h2>
        <DataError
          v-if="committeesError && !committeesData"
          :retrying="committeesStatus === 'pending'"
          @retry="refreshCommittees"
        />
        <div v-else class="stagger-list grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CommitteeCard
            v-for="card in cards"
            :key="card.committee.slug"
            :committee="card.committee"
            :plenary="card.plenary"
          />
        </div>
        <p v-if="!committeesError && committees.length === 0" class="text-muted py-12 text-center">
          Todavía no hay comisiones configuradas.
        </p>
      </section>
    </UContainer>
  </div>
</template>
