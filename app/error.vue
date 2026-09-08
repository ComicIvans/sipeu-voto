<script setup lang="ts">
import type { NuxtError } from '#app'
import { es } from '@nuxt/ui/locale'

const props = defineProps<{ error: NuxtError }>()

const status = computed(() => props.error.statusCode ?? 500)
const title = computed(() => {
  if (status.value === 404) return 'Página no encontrada'
  if (status.value === 403) return 'Acceso no permitido'
  return 'Algo ha salido mal'
})

useHead({ title: () => `${status.value}` })

async function goHome() {
  await clearError({ redirect: '/' })
}
</script>

<template>
  <UApp :locale="es">
    <div class="bg-default flex min-h-screen flex-col">
      <AppHeader />
      <main class="flex flex-1 items-center justify-center px-4 py-16">
        <div class="w-full max-w-xl text-center">
          <p aria-hidden="true" class="text-primary text-7xl font-bold sm:text-8xl">{{ status }}</p>
          <h1 class="mt-4 text-2xl font-semibold">{{ title }}</h1>
          <p class="text-muted mt-3">{{ error.statusMessage || error.message }}</p>
          <div class="mt-8 flex justify-center">
            <UButton size="lg" color="primary" icon="i-lucide-house" @click="goHome">
              Volver al inicio
            </UButton>
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  </UApp>
</template>
