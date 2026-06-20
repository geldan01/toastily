<script setup lang="ts">
// Simple 1–5 star rating (issue #60). Interactive by default; `readonly` renders
// a static display (used in the participation timeline).
import { Star } from '@lucide/vue'

const props = withDefaults(defineProps<{
  modelValue: number
  readonly?: boolean
  ariaLabel?: string
}>(), { readonly: false, ariaLabel: '' })

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const stars = [1, 2, 3, 4, 5]
function pick(n: number) {
  if (props.readonly) return
  // Tapping the current value clears it back to 0 (lets a misclick be undone).
  emit('update:modelValue', props.modelValue === n ? 0 : n)
}
</script>

<template>
  <div
    class="flex items-center gap-1"
    role="img"
    :aria-label="ariaLabel"
  >
    <button
      v-for="n in stars"
      :key="n"
      type="button"
      :disabled="readonly"
      :aria-label="String(n)"
      :class="readonly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110'"
      @click="pick(n)"
    >
      <Star
        :class="[
          readonly ? 'size-4' : 'size-7',
          n <= modelValue ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40',
        ]"
      />
    </button>
  </div>
</template>
