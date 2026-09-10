<script setup lang="ts">
/**
 * The light/dark switch, in one component so the public header and the admin
 * navbar cannot drift apart.
 *
 * Nuxt UI's ghost button fills with `bg-elevated` while pressed, and that token
 * is exactly what this button changes: the press paints a slab that ends up a
 * different colour than it started, and over the blue header it is a grey box
 * besides. Here the press is a scale, which no theme can repaint, and the tint
 * is taken from the current text colour, so it suits the white header and the
 * admin panel without either of them naming a colour.
 */
const props = withDefaults(
  defineProps<{
    /** Over the brand-blue header, where everything is white. */
    inverted?: boolean
  }>(),
  { inverted: false }
)
</script>

<template>
  <UColorModeButton
    color="neutral"
    variant="ghost"
    :class="[
      'transition-transform duration-150 active:scale-90',
      'hover:bg-current/10 focus-visible:bg-current/10 active:bg-current/10',
      'focus-visible:ring-2 focus-visible:outline-none',
      props.inverted
        ? 'text-white hover:text-white focus-visible:ring-white/70'
        : 'focus-visible:ring-primary',
    ]"
  />
</template>
