<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { ADMIN_ROUTES, USER_ROUTES } from '~~/shared/constants/routes'

definePageMeta({ layout: false })

const { signIn, user } = useAuth()
const route = useRoute()

const schema = z.object({
  email: z.email('Introduce un correo válido'),
  password: z.string().min(1, 'Introduce tu contraseña'),
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ email: '', password: '' })
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true
  errorMessage.value = null
  try {
    await signIn(event.data.email, event.data.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
    await navigateTo(
      redirect && redirect.startsWith('/')
        ? redirect
        : user.value?.role === 'admin'
          ? ADMIN_ROUTES.dashboard
          : USER_ROUTES.vote
    )
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se ha podido iniciar sesión.'
  } finally {
    isLoading.value = false
  }
}

useHead({ title: 'Acceder' })
</script>

<template>
  <div class="bg-default flex min-h-screen flex-col">
    <main class="eu-hero flex flex-1 items-center justify-center px-4 py-12">
      <div class="animate-fade-slide-up w-full max-w-md">
        <div class="bg-default overflow-hidden rounded-2xl shadow-2xl">
          <div class="bg-sipeu-700 dark:bg-sipeu-900 px-8 py-8 text-center text-white">
            <img src="/brand/sipeu-white.png" alt="SIPEU" class="mx-auto h-20 w-auto" />
            <h1 class="mt-4 text-xl font-bold">Votaciones SIPEU</h1>
            <p class="mt-1 text-sm text-white/75">Acceso para participantes</p>
          </div>

          <div class="p-8">
            <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
              <UFormField name="email" label="Correo electrónico" required>
                <UInput
                  v-model="state.email"
                  type="email"
                  autocomplete="email"
                  placeholder="tu@correo.com"
                  icon="i-lucide-mail"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UFormField name="password" label="Contraseña" required>
                <UInput
                  v-model="state.password"
                  type="password"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  icon="i-lucide-lock"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UAlert
                v-if="errorMessage"
                color="error"
                variant="subtle"
                icon="i-lucide-alert-circle"
                :title="errorMessage"
              />

              <UButton type="submit" block size="lg" color="primary" :loading="isLoading">
                Entrar
              </UButton>
            </UForm>

            <div class="bg-muted/60 text-muted mt-6 rounded-lg p-3 text-center text-xs">
              ¿No recuerdas tu contraseña? Contacta con la organización para que te genere una
              nueva.
            </div>
          </div>
        </div>

        <div class="mt-6 text-center">
          <NuxtLink to="/" class="text-sm text-white/80 hover:text-white">
            ← Ver resultados sin iniciar sesión
          </NuxtLink>
        </div>
      </div>
    </main>
    <AppFooter />
  </div>
</template>
