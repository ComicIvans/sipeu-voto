<script setup lang="ts">
import { es } from '@nuxt/ui/locale'
import { SITE_NAME } from '~~/shared/constants/links'

useHead({
  titleTemplate: (titleChunk) => (titleChunk ? `${titleChunk} | ${SITE_NAME}` : SITE_NAME),
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator
    color="linear-gradient(90deg, var(--color-sipeu-500), var(--color-eu-400))"
    :height="3"
  />
  <UApp :locale="es">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
