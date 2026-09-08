<script setup lang="ts">
import type { PublicCommittee, VoteSummary } from '~~/shared/types/api'

const route = useRoute()
const slug = route.params.slug as string

const { data, error, refresh, status } = await useFetch<{
  data: {
    committee: PublicCommittee & { id: string | null }
    cover: string | null
    isPlenary: boolean
    votes: VoteSummary[]
  }
}>(`/api/committees/${slug}`)

if (error.value && getApiErrorStatus(error.value) === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Comisión no encontrada', fatal: true })
}

const committee = computed(() => data.value?.data.committee)
const cover = computed(() => data.value?.data.cover ?? null)
const votes = computed(() => data.value?.data.votes ?? [])
const openVotes = computed(() => votes.value.filter((vote) => vote.status === 'open'))
const pendingVotes = computed(() => votes.value.filter((vote) => vote.status === 'pending'))
const closedVotes = computed(() => votes.value.filter((vote) => vote.status === 'closed'))

const { isConnected } = useLiveRefresh(refresh, (event) => {
  if (event.type === 'vote-changed') {
    return event.committeeId === (committee.value?.id ?? null)
  }
  // Group changes matter again: the vote cards carry group logos.
  return true
})

useHead({ title: () => committee.value?.name ?? 'Comisión' })
</script>

<template>
  <UContainer class="animate-fade-slide-up py-8 sm:py-12">
    <NuxtLink
      to="/"
      class="text-muted hover:text-highlighted inline-flex items-center gap-1 text-sm"
    >
      <UIcon name="i-lucide-arrow-left" class="size-4" />
      Todas las comisiones
    </NuxtLink>

    <DataError
      v-if="error && !data"
      class="mt-6"
      :retrying="status === 'pending'"
      @retry="refresh"
    />

    <template v-else>
      <div class="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <!-- Title over the image, with the scrim underneath it: the cover is
               a photograph and cannot be trusted to be dark where the text is. -->
          <div v-if="cover" class="relative mb-4 overflow-hidden rounded-xl">
            <CommitteeCover :cover="cover" :plenary="data?.data.isPlenary" scrim />
            <div class="absolute inset-x-0 bottom-0 p-4 sm:p-6">
              <p class="text-xs font-semibold tracking-widest text-white/80 uppercase">
                {{ data?.data.isPlenary ? 'Sesión plenaria' : 'Comisión' }}
              </p>
              <h1 class="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                {{ committee?.name }}
              </h1>
            </div>
          </div>
          <template v-else>
            <p class="text-muted text-xs font-semibold tracking-widest uppercase">
              {{ data?.data.isPlenary ? 'Sesión plenaria' : 'Comisión' }}
            </p>
            <h1 class="text-highlighted text-3xl font-bold tracking-tight sm:text-4xl">
              {{ committee?.name }}
            </h1>
          </template>
        </div>
        <div class="flex items-center gap-3">
          <UAlert
            v-if="error"
            color="warning"
            variant="subtle"
            icon="i-lucide-wifi-off"
            title="Datos desactualizados"
            class="w-auto"
          />
          <LiveIndicator :connected="isConnected" />
        </div>
      </div>

      <section v-if="openVotes.length > 0" class="mt-8">
        <h2 class="text-highlighted mb-3 flex items-center gap-2 text-lg font-semibold">
          <span class="relative flex size-2.5">
            <span
              class="animate-pulse-live absolute inline-flex size-full rounded-full bg-green-400 opacity-75"
            />
            <span class="relative inline-flex size-2.5 rounded-full bg-green-500" />
          </span>
          En curso
        </h2>
        <div class="stagger-list grid gap-4 md:grid-cols-2">
          <VoteCard v-for="vote in openVotes" :key="vote.id" :vote="vote" />
        </div>
      </section>

      <section v-if="pendingVotes.length > 0" class="mt-8">
        <h2 class="text-highlighted mb-3 flex items-center gap-2 text-lg font-semibold">
          <UIcon name="i-lucide-clock" class="text-muted size-5" />
          Pendientes de abrir
        </h2>
        <div class="stagger-list grid gap-4 md:grid-cols-2">
          <VoteCard v-for="vote in pendingVotes" :key="vote.id" :vote="vote" />
        </div>
      </section>

      <section class="mt-8">
        <h2 class="text-highlighted mb-3 text-lg font-semibold">Finalizadas</h2>
        <div v-if="closedVotes.length > 0" class="stagger-list grid gap-4 md:grid-cols-2">
          <VoteCard v-for="vote in closedVotes" :key="vote.id" :vote="vote" />
        </div>
        <div
          v-else
          class="border-default text-muted rounded-xl border border-dashed py-12 text-center"
        >
          <UIcon name="i-lucide-inbox" class="mx-auto size-10" />
          <p class="mt-3">Todavía no hay votaciones finalizadas.</p>
        </div>
      </section>
    </template>
  </UContainer>
</template>
