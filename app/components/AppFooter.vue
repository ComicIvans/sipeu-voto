<script setup lang="ts">
import {
  DEVELOPER_GITHUB,
  DEVELOPER_LINKEDIN,
  DEVELOPER_NAME,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
} from '~~/shared/constants/links'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-default mt-12 border-t">
    <div class="eu-stars h-1.5 w-full opacity-70" aria-hidden="true" />
    <div
      class="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 text-center text-sm sm:px-6 lg:flex-row lg:justify-between lg:text-left"
    >
      <div class="flex flex-col items-center gap-1 lg:items-start">
        <p class="text-highlighted font-semibold">Simulación del Parlamento Europeo en Canarias</p>
        <p class="text-muted">SIPEU · {{ year }}</p>
      </div>

      <UButton
        :to="INSTAGRAM_URL"
        target="_blank"
        rel="noopener noreferrer"
        color="neutral"
        variant="outline"
        icon="i-simple-icons-instagram"
      >
        {{ INSTAGRAM_HANDLE }}
      </UButton>

      <div class="text-muted flex flex-col items-center gap-1 lg:items-end">
        <p>
          Desarrollado por
          <span class="text-highlighted font-medium">{{ DEVELOPER_NAME }}</span>
        </p>
        <div class="flex items-center gap-1">
          <UButton
            :to="DEVELOPER_LINKEDIN"
            target="_blank"
            rel="noopener noreferrer"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-simple-icons-linkedin"
            aria-label="LinkedIn de Iván Salido Cobo"
          />
          <UButton
            :to="DEVELOPER_GITHUB"
            target="_blank"
            rel="noopener noreferrer"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-simple-icons-github"
            aria-label="GitHub de Iván Salido Cobo"
          />
        </div>
      </div>
    </div>
  </footer>
</template>
