<script setup lang="ts">
import type { PublicGroup, VoteSummary } from '~~/shared/types/api'

const { user, refresh: refreshUser } = useAuth()

interface MyVotesResponse {
  data: { hasCommittee: boolean; votes: Array<VoteSummary & { myOptionId: string | null }> }
}

interface DirectoryMember {
  id: string
  name: string
  image: string | null
  role: string
  group: PublicGroup | null
}

const { data: votesData, refresh: refreshVotes } = await useFetch<MyVotesResponse>('/api/me/votes')
const { data: directoryData, refresh: refreshDirectory } = await useFetch<{
  data: DirectoryMember[]
}>('/api/me/directory')

const votes = computed(() => votesData.value?.data.votes ?? [])
const openVotes = computed(() => votes.value.filter((vote) => vote.open))
const pendingVotes = computed(() => openVotes.value.filter((vote) => !vote.myOptionId))
const closedVotes = computed(() => votes.value.filter((vote) => !vote.open))
const members = computed(() => directoryData.value?.data ?? [])

const { isConnected } = useLiveRefresh(async () => {
  await Promise.all([refreshVotes(), refreshDirectory(), refreshUser()])
})

useHead({ title: 'Votar' })
</script>

<template>
  <UContainer class="animate-fade-slide-up py-8 sm:py-12">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-center gap-4">
        <UserAvatar :user="user" size="xl" />
        <div>
          <h1 class="text-highlighted text-2xl font-bold sm:text-3xl">
            Hola, {{ user?.firstName }}
          </h1>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <UBadge
              v-if="user?.committee"
              color="primary"
              variant="subtle"
              icon="i-lucide-landmark"
            >
              {{ user.committee.name }}
            </UBadge>
            <GroupBadge :group="user?.group" full size="sm" />
            <UBadge
              v-if="user?.role === 'admin'"
              color="neutral"
              variant="subtle"
              icon="i-lucide-shield"
            >
              Organización
            </UBadge>
          </div>
        </div>
      </div>
      <LiveIndicator :connected="isConnected" />
    </div>

    <UAlert
      v-if="!user?.committee"
      class="mt-8"
      color="warning"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      title="Sin comisión asignada"
      description="No tienes ninguna comisión asignada, así que no puedes votar. Contacta con la organización."
    />

    <template v-else>
      <section class="mt-8">
        <h2 class="text-highlighted mb-3 flex items-center gap-2 text-lg font-semibold">
          <UIcon name="i-lucide-vote" class="text-primary size-5" />
          Votaciones abiertas
          <UBadge v-if="pendingVotes.length > 0" color="success" variant="solid" size="sm">
            {{ pendingVotes.length }} pendiente{{ pendingVotes.length === 1 ? '' : 's' }}
          </UBadge>
        </h2>

        <div v-if="openVotes.length > 0" class="stagger-list grid gap-4 md:grid-cols-2">
          <div v-for="vote in openVotes" :key="vote.id" class="relative">
            <VoteCard :vote="vote" :show-committee="vote.committeeId === null" />
            <UButton
              v-if="!vote.myOptionId"
              :to="`/v/${vote.id}`"
              color="success"
              size="sm"
              icon="i-lucide-arrow-right"
              trailing
              class="absolute right-4 bottom-4"
            >
              Votar ahora
            </UButton>
          </div>
        </div>
        <div
          v-else
          class="border-default text-muted rounded-xl border border-dashed py-10 text-center"
        >
          <UIcon name="i-lucide-coffee" class="mx-auto size-10" />
          <p class="mt-3">No hay ninguna votación abierta ahora mismo.</p>
          <p class="text-xs">Esta página se actualiza sola cuando la organización abra una.</p>
        </div>
      </section>

      <section v-if="closedVotes.length > 0" class="mt-10">
        <h2 class="text-highlighted mb-3 text-lg font-semibold">Votaciones anteriores</h2>
        <div class="stagger-list grid gap-4 md:grid-cols-2">
          <VoteCard
            v-for="vote in closedVotes"
            :key="vote.id"
            :vote="vote"
            :show-committee="vote.committeeId === null"
          />
        </div>
      </section>

      <section class="mt-10">
        <h2 class="text-highlighted mb-3 flex items-center gap-2 text-lg font-semibold">
          <UIcon name="i-lucide-users" class="text-primary size-5" />
          Miembros de {{ user?.committee?.name }}
          <span class="text-muted text-sm font-normal">({{ members.length }})</span>
        </h2>
        <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="member in members"
            :key="member.id"
            class="border-default bg-default flex items-center gap-3 rounded-xl border p-3"
          >
            <UserAvatar :user="member" size="lg" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ member.name }}</p>
              <div class="mt-0.5 flex items-center gap-1.5">
                <GroupBadge :group="member.group" size="xs" />
                <span v-if="member.role === 'admin'" class="text-muted text-[11px]"
                  >Organización</span
                >
              </div>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </UContainer>
</template>
