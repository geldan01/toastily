<script setup lang="ts">
// Renders a scannable QR code for a URL (PRD §9 — the guest check-in QR). Encodes
// client/server-side via the `qrcode` lib into a data-URL image; the white padding
// keeps it scannable on any background when projected.
import QRCode from 'qrcode'

const props = defineProps<{ value: string, size?: number }>()

const src = ref('')
watchEffect(async () => {
  if (!props.value) {
    src.value = ''
    return
  }
  try {
    src.value = await QRCode.toDataURL(props.value, { width: props.size ?? 220, margin: 1 })
  }
  catch { src.value = '' }
})
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :width="size ?? 220"
    :height="size ?? 220"
    alt="QR code"
    class="rounded-md bg-white p-2 shadow-sm"
  >
</template>
