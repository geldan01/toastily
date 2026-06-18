<script setup lang="ts">
/**
 * Member profile picture (issue #43). Shows the member's uploaded photo when
 * one exists, otherwise a default avatar: a circle with the member's first
 * initial. Used in the roster, featured testimonials, the account page, and
 * anywhere a member is represented. `size` is the diameter in pixels.
 */
const props = withDefaults(defineProps<{
  name: string
  src?: string | null
  size?: number
}>(), {
  src: null,
  size: 40,
})

const initial = computed(() => props.name?.trim().charAt(0).toUpperCase() || '?')
// Scale the fallback initial with the avatar so it stays centred and legible.
const fontSize = computed(() => `${Math.round(props.size * 0.4)}px`)
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :alt="name"
    :width="size"
    :height="size"
    :style="{ width: `${size}px`, height: `${size}px` }"
    class="shrink-0 rounded-full object-cover"
    loading="lazy"
  >
  <div
    v-else
    :style="{ width: `${size}px`, height: `${size}px`, fontSize }"
    class="grid shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary"
    :aria-label="name"
  >
    {{ initial }}
  </div>
</template>
