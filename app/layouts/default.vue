<template>
  <div class="bg-default flex min-h-screen flex-col">
    <a href="#main-content" class="skip-link">Saltar al contenido</a>
    <AppHeader />
    <main id="main-content" tabindex="-1" class="flex-1">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
